# Maquettes — autres modules (hors Réception, Identification, Dispatch, Instructions, Trains, Unitaire, Bagues, Alertes)

Source : `docs-sources/2. CIRCE CIBLE + MAQUETTE/maquette/` (HTML/JS statique, V2 du 14/10/2026, mise à jour jusqu'au 02/11/2026, « option A »). Analyse en lecture seule.
Les données MOCK (`assets/js/data.js`, seed fixe `mulberry32(20261013)`, date simulée mardi 13/10/2026 10h, semaine de production S42 pour départ S43) servent à comprendre, jamais à être recopiées.

Fichiers lus intégralement : `index.html`, `README.md`, `DESIGN.md`, `app.js`, `core.js`, `charts.js`, `screens/{themes,stock,parametrage,reservations,suivi,expedition,fincampagne,generateur,besoins,parcours}.js`. Lus en partie : `data.js` (lignes 1-525, 681-1297 : sauf alertes 1044-1100 et algorithme de similarité 1070-1100), `besoins.js` (assets, 70 lignes sur 253), `apercu-navigation-haut.html` (extractions ciblées : 284 Ko, SVG ECharts inline). Non lus : `ui.js`, `app.css`, `notes/*.md`, vendors.

---

## 0. DÉPENDANCES de Réception et Coordination (section prioritaire)

Convention : **R** = écrans Réception (reception, identification), **C** = écrans Coordination (onglet Pré-production : `instructions`, `themes` ; et `trains`/`unitaire`/`bagues`/`dispatch` côté ateliers). Les écrans R et C ne sont pas décrits ici, seuls leurs points de contact le sont.

### 0.1 Ce que Réception PRODUIT et que mes écrans CONSOMMENT

| Produit par Réception | Où c'est consommé | Détail |
|---|---|---|
| Réception (`R26xxxx`, statuts `A_CONTROLER`, `A_IDENTIFIER`) et sa palette en sas | Menu Réception : badge « n palette(s) à contrôler » (`app.js`/`core.js`) ; Alerte `CONTROLE_RETARD` ; Paramétrage › Règles métier (délai de contrôle) | `C.receptionsAControler()` |
| Affiche reçue (n° `712xxx`, `qteRecue`, `alloc[{themeId,qte}]`, `allee`/`rayon`, `rebut`, `aConserver`, `semaines`, `feuilleImprimee` TEMPORAIRE/DEFINITIVE, `statut` IDENTIFIEE/ORPHELINE, `rattache` BL/VISUEL/MAIN) | **Stock par affiche (ECR-STK-01)**, **Mouvements (STK-02)**, **Fin de campagne (STK-03)**, **EDR vivant (PIL-03)** colonnes Reçu / Reste à recevoir / Affiche reçue / N° d'affiche (✓ validée, • proposée) / Où en est-il, **Suivi de prod (PIL-01/02)** colonnes Reçu, Reste, état Réception | `C.recu(themeId)` = somme des `alloc` ; `C.etatTheme` : MANQUANT / PARTIEL / COMPLET / SURPLUS (>+10 %) / SANS_ATTENDU / NON_ATTENDU |
| Mouvement de stock `Réception` (+qteRecue, `auto:false`, user = contrôleur) | STK-02, STK-01 (`stockDispo` = somme des mouvements) | un mouvement par affiche créée |
| Rebut à la réception (`a.rebut`) | STK-01 (colonne Disponible + pastille « n rebut », action « Mettre au rebut ») | le rebut est saisi aussi dans Stock (STK-01), pas seulement au contrôle |
| Rattachement proposé par Circé / validation admin (`a.va`, motifs BL, FORMAT, THEME, MULTI, SANS_IP, ANNULEE) | PIL-03 (colonne « Validation admin », « N° d'affiche »), Alertes `VALIDATION_ADMIN`, écran Instructions (C) | `C.vaEtat/vaMotifs/vaDossier/vaResume`, `C.majStatutVA(d)` |
| Thème d'affiche modifié (`a.themeModif`) | Tag « Feuille à refaire » de la Liste des affiches (R), déclenché depuis THM-03 (« Reprendre la version BC ») via `C.noterThemeModifie` | écriture de THM vers Réception |
| Unités qui passent `EN_ATTENTE` → `PRET` | PIL-01/02 (A, B, A−B, C), GEN-01/02 (unités prêtes), EXP-03 | `C.recalculer()` après réception |
| Réceptions attendues anciennes (`RA-36-0`…, purge à 4 semaines sauf conservation) | Paramétrage › Règles métier (purge) ; journal « Purge automatique » (ADM-08) | |

### 0.2 Ce que Réception CONSOMME venant de mes écrans

| Source | Consommé par R | Détail |
|---|---|---|
| ECR-ADM-05 Règles métier | écart reçu signalé > 10 % (`ecartReception`), purge attendues (`purgeAttendues` = 4), délai de contrôle du sas (`delaiControle` = 24 h), comptage par morceau < 30 (`comptageMorceau`), exemplaires de feuilles de stock (`exemplairesFeuille` = 2), allée des réceptions inconnues (`alleeInconnues` = 'X') | tous paramétrables, aujourd'hui en dur dans le code d'après les notes (« existant ») |
| ECR-ADM-07 Référentiels | listes proposées à la saisie d'une réception : Imprimeurs, Livreurs (`transporteursEntrants`), Agents de réception / contrôleurs (REC-14, REC-12) ; destinataires et afficheurs | `M.ref.imprimeurs` (6), `transporteursEntrants` (4), `controleurs` (4) |
| ECR-ADM-04 Alertes et mails | règles d'alerte de la réception (MANQUANT, ECART, SANS_IP, ORPHELINE, DOSSIER_INTROUVABLE, FEUILLE_DEFINITIVE, CONTROLE_RETARD, VALIDATION_ADMIN, MAIL_COMMERCIAL désactivée) : déclencheur, seuil, destinataires, canal | l'écran Alertes (autre agent) lit ces types ; ici ils sont configurés |
| ECR-ADM-03 Statuts | catalogue de 109 statuts/tags dont ceux de la réception (palette, ligne attendue, affiche, réception inconnue) avec leur ORIGINE C/E/B/N | les statuts « N » (à ajouter en V2) sont : réception inconnue à identifier, palette à contrôler / contrôlée, contrôleur, non-conformité, surplus compté en entretien, feuille temporaire/définitive, introuvable |
| Statut du dossier et préparation (`statutPP` A_TRAITER / PREPA_RECUE / VALIDE / ANNULE ; `ipSaisies`) | calcul « Où en est-il » (DA, IP, AFFICHES, PARTIEL, PREPA…) et attendu (`t.qteEnt`, quantités avant prépa = quantité de Broadcast) | produit par Broadcast / Coordination |
| Expédition (ECR-EXP-02) | sorties de stock automatiques (`Expédition C-…`) qui diminuent le disponible des affiches reçues | boucle Réception → Stock → Expédition |

### 0.3 Ce que Coordination PRODUIT et que mes écrans CONSOMMENT

| Produit par Coordination | Consommé par | Détail |
|---|---|---|
| Statuts de préparation / Instruction OK (`statutPP`, `d.iok`, `commentPrepa`, `qteBCInfo` écart BC/Circé) | THM-01/02/03 (colonne « Statut pré-production », `C.statutDossier`), PIL-03 (« Pré-production (Broadcast) », `etapeOf`), PIL-02 (col. masquée Statut pré-production), Alertes `IP_MANQUANTES`, `ECART_BC` | |
| Validation admin confirmée en lot (`C.validerAffiches`, `C.annulerValidation`) | PIL-03 (« Validation admin », pastilles ✓ / •), PIL-03 « Où en est-il » = PREPA (« Affiches reçues, validation admin à confirmer ») | |
| Export des trains (jeudi 14 h, « A imprimer », `d.exporte`) | `renvoiPrepa` (simulation Broadcast) : après export, les trains restent figés et une alerte part | statut « A imprimer » = ancien code 5 |
| Trains / UM / lots (`u.statut` EN_ATTENTE, PRET, EN_PROD, PRODUIT, COLISE, EXPEDIE, LIVRE ; `u.positions`, `u.dest`, `u.afficheur`, `u.machine`, `u.nb`) | PIL-01/02 (étapes), PIL-03 (grains Unité/Colis/Départ), GEN-01/02 (unités PRET d'une machine), EXP-01/03 | le Générateur change le statut en `EN_PROD` à l'envoi (point de non-retour) |
| Libération de semaine (fixe/pliage, `D.liberations`) | alerte `APRES_LIBERATION` (simulation), journal ADM-08, badge de l'onglet fixe/pliage | |
| Demandes de correction thème/annonceur (`demandesThemes`, `demandesAnnonceurs`, mail au gestionnaire du pôle) | THM-01/02 (états DEMANDE, CORRIGE), ADM-04 (liste de distribution « Corrections de thème à Broadcast ») | produit AVEC THM : THM est l'écran de Coordination (rôles `coord`, `admin`) |

### 0.4 Ce que Coordination CONSOMME venant de mes écrans

| Source | Consommé par C | Détail |
|---|---|---|
| THM (vérification des thèmes) | liens vers `instructions` (« Ouvrir le dossier » : `{statut:'TOUS', q: dossier}`), `reservations` (« Voir le dossier »), alertes THEMES_PROCHES / ANNONCEURS_PROCHES / THEME_BC | THM est lui-même un écran Pré-production (même onglet que Instructions) |
| PIL-03 EDR vivant | paramètres d'URL `?ou=AFFICHES,PARTIEL`, `?dossier=`, `?par=` utilisés depuis Alertes, Instructions, THM ; fiche dossier (tiroir `ui.dossierDrawer`) réutilisée par plusieurs écrans | |
| GEN-01 Vendôme | trains cochés dans Déroulant › Liste des trains / Préparation arrivent pré-sélectionnés (`G.preselect`) ; limite 20 tiroirs (bloquante) | |
| ADM-05 Règles métier | entretien (grain afficheur, seuil 3, arrondi supérieur), positions max par train (4 deck / 6 code), tiroirs 20, Instruction OK automatique (règle de Nariman 26/10 : commentaire de prépa vide ET exceptions = quantité), campagne contrôlée (15 %), seuil de similarité 0,85 des thèmes proches, regroupements d'enseignes (`*MISTRAL*` → `MISTRAL`) | affichés en lecture dans la section « Trains » (non modifiables dans la maquette) |
| ADM-01 / ADM-02 | ateliers, gammes (étapes par mode : Vendôme, hors Vendôme, fixe, colle/pliage, bus), machines, critères d'ordonnancement | |
| ADM-03 table de correspondance `tr_statut` | codes 0-10 existants → statuts cibles (utile pour la migration) | |
| STK-03 Fin de campagne | rôle `coord` autorisé (avec recep, cheq) | |
| Statuts du dossier | `M.STATUTS` (13 clés) partagé par tous les écrans | |

### 0.5 Liens de navigation partagés (entrées/sorties)

- PIL-01 → `reservations?ou=AFFICHES,PARTIEL` ; → `alertes` ; → fiche dossier ; fiche dossier → `instructions?q=` (« Voir dans Instructions ») et `reception?tab=affiches&q=` (« Voir les affiches »).
- THM-03 → `reservations?dossier=` ; THM-01/02 → `instructions?statut=TOUS&q=`.
- EXP-02 « Fin de journée Geodis » exécute la simulation du même nom (`M.SIMULATIONS`) ; Parcours 9 → `stock?tab=mvt`.
- Alertes (autre agent) → `reservations?q=`, `reception?tab=affiches&q=`, `identification?id=`, `instructions?...`, `unitaire?...`, `trains?q=`.
- Les mêmes écrans servent plusieurs onglets via le contexte d'URL (`pour`, `type`, `atelier`, `machine`, `tab`) : `suivi` (Pilotage + 4 ateliers), `instructions` (Pré-production + Déroulant), `generateur` (Vendôme + multi-rouleuse), `reception` (3 vues).

### 0.6 Écarts / points d'attention pour les équipes Réception et Coordination

1. **Rôle « Pré-Prod » supprimé le 27/10** : DESIGN.md §0/§8 parle encore parfois de Pré-Prod ; le rôle de travail dans Circé est « Coordination ». Rôles : Coordination, Chef d'équipe, Agent de réception, Agent d'expédition, Administrateur, Commerce (lecture).
2. **Le stock est le somme des mouvements** (`stockDispo = Σ mouvements.qte`), pas un compteur : la mise au rebut, la destruction et l'expédition sont des mouvements négatifs. À arbitrer avec l'existant (RG de stock).
3. **L'`apercu-navigation-haut.html` est obsolète** (généré 14/10, V1.2 : 7 onglets de Circé actuel, « validation unique », « Anciennes à purger », « Admin Equipe »…). La navigation de référence est celle de `core.js` (`M.NAV`, 10 onglets). Voir ECR-NAV-02.
4. **Statut dossier interne `VALIDE`** n'est jamais affiché : à l'écran, « Préparation reçue » + pastille « Validation admin » à part (`C.statutDossier`).
5. Plusieurs `exportName` finissent en `.csv` alors que l'export est un `.xlsx` (le suffixe est retiré, cf. `downloadXLSX`). Seuls Vendôme et multi-rouleuse restent CSV.
6. Libellé « Terminé » (ancien code 8) remplacé par « Expédié » puis « Livré » ; « Préparé » (6) = « Produit » ; « A imprimer » (5) = « Prêt à produire » ; 9 et 10 = « En production ».

---

## 1. Conventions de numérotation (MOD déduit et justifié)

Le code ne porte pas d'identifiant d'écran ; chaque `M.screen({ id })` correspond à un écran, certains ayant plusieurs vues (`?tab=` / `?pour=`). Je compte **une vue = un écran** (comme le menu : « une entrée = une vue précise »). MOD par rattachement fonctionnel au menu de la maquette :

| MOD | Justification | Écrans |
|---|---|---|
| NAV | Coque de navigation (core.js, index.html, apercu-navigation-haut.html), transverse | NAV-01, NAV-02 |
| PIL | Onglet « Pilotage » (+ suivi de prod des ateliers) | PIL-01 à PIL-04 |
| THM | « Vérification des thèmes » (onglet Pré-production). Fonctionnellement **Coordination** : à rattacher à `COO` si l'agent Coordination souhaite fusionner ; gardé distinct ici pour éviter une collision de numéros | THM-01 à THM-03 |
| STK | Onglet « Stocks » | STK-01 à STK-03 |
| EXP | Onglet « Expédition » | EXP-01 à EXP-03 |
| GEN | Générateur de fichiers de prod (Déroulant › Fichiers Vendôme, 2 m² fixe › Fichiers multi-rouleuse) | GEN-01 à GEN-03 |
| ADM | Onglet « Administration » (Paramétrage) | ADM-01 à ADM-08 |
| AID | Menu « Aide » : propre à la maquette, **hors périmètre cible** | AID-01, AID-02 |

Total : **28 écrans/vues** (+ 1 fiche partagée, PIL-04, + modales décrites dans leur écran).

Composants transverses communs à tous les tableaux (à ne pas répéter à chaque écran) :
- En-tête (`ui.pageHead`) : fil d'Ariane « Onglet · Page », titre, sous-titre, bouton « Besoins couverts » (annotation maquette, hors cible), bouton « ← Retour : <page> » si ouvert par lien.
- Barre de filtres (`ui.filters`) : « N° de dossier » (multi, collage de liste, puces), « Départ » (semaines S42-S45), 4 filtres visibles max, autres via « + Filtre », « Réinitialiser », compteurs par valeur, filtres « smart ». Placée dans la barre d'outils du premier tableau (sauf dashboard).
- Tableau (`ui.table`, Tabulator) : 8 colonnes visibles max, menu « Colonnes » (ordre, vue gardée sur le poste), « Compact/Confort », filtre sous chaque en-tête (texte sans accents, `>10`, `<5`, `=0`), « Exporter » (.xlsx), tri, sélection par case, actions groupées à la sélection, pied de totaux, état vide (phrase), liseré coloré par gravité (`tone`).
- Indicateurs (`ui.stat`) : 4-5 tuiles cliquables qui posent un filtre.
- Toasts 5 s en bas à droite ; modale courte pour agir, panneau latéral (`drawer`) pour consulter.
- **États** : l'état vide est présent partout (`empty:` ou `dt-empty`). Aucun état « chargement » ni « erreur » (données en mémoire). Seule erreur : encadré rouge « Erreur d'affichage de l'écran » (core.js `renderMain`). À signaler : États chargement/erreur API = à concevoir.

---

## 2. Navigation (coque)

### ECR-NAV-01 — Coque : bandeaux, onglets, menus
- Fichier source : `index.html`, `assets/js/core.js` (`M.NAV`, `renderTopbar`, `renderMenubar`, `openTabMenu`), `app.js` (`M.start`), README §2-3, DESIGN §5.
- Accès : toutes les pages. Ouverture sur `#/suivi` (Pilotage › Suivi de prod) ; le logo y ramène (pas de page d'accueil, décision 16/10).
- Structure : bandeau 1 bleu nuit (logo « Circé · Maquette cible », sélecteur Site, sélecteur Rôle, cloche alertes avec badge, enveloppe mails, « Simuler », interrupteur « Besoins », menu « Aide ») ; bandeau 2 blanc avec 10 onglets ; zone `main`. Routeur par ancre `#/ecran?param=valeur`.
- Onglets et entrées (M.NAV) :
  - Pilotage : Suivi de prod, État des réservations vivant, Alertes.
  - Réception : Réception des affiches (`?tab=attendues`, vues attendues/saisie/controle ; badge palettes à contrôler), Liste des affiches (`?tab=affiches`), Réceptions inconnues (`identification`).
  - Pré-production : Validation admin et Instruction OK (`instructions`) ; Vérification des thèmes (sous-entrées : Thèmes proches entre dossiers, Annonceurs proches, Thèmes modifiés dans Broadcast, avec compteurs).
  - Déroulant : Suivi de prod (`pour=deroulant`), Liste des instructions (`pour=deroulant`), Liste des trains, Suivi par thème, Préparation, Suivi 8 m² (demies) (`trains` tab=trains/besoin/prepa/d8), Fichiers Vendôme (`generateur`, sous-entrées par machine), Bagues, Dispatch (sous-entrées par atelier).
  - 2 m² fixe : Suivi de prod, Préparation (`unitaire?type=fixe`, sous-entrées par atelier ; badge « arrivés après libération »), Fichiers multi-rouleuse.
  - Pliage : Suivi de prod, Préparation (par atelier).
  - Bus : Suivi de prod, Préparation par centre.
  - Expédition : sous-entrées Scan et colisage, Colis, Départs camions.
  - Stocks : Stock (Stock par affiche, Mouvements), Fin de campagne.
  - Administration : Paramétrage (8 sous-entrées).
  - Aide (bandeau 1) : Parcours guidés, Traçabilité des besoins.
- Filtres : Site (Tous les sites, Nîmes, Wissous, Nanterre (Bus) (cible)) vaut pour toute l'application (`M.state.site`, `M.inScope`), mémorisé en `sessionStorage` avec le rôle et « Besoins ». Rôle : Coordination, Chef d'équipe (défaut), Agent de réception, Agent d'expédition, Administrateur, Commerce (lecture).
- Formulaires : aucun.
- Actions : clic onglet → liste déroulante (une seule ouverte ; clic ailleurs/Échap ferme) ; cloche → `alertes` ; enveloppe → boîte « Mails » simulée ; « Simuler » → 10 événements (voir §A) ; interrupteur Besoins ; Aide ; changement de rôle → grise (`dim`) les pages secondaires du rôle (`roles` de chaque écran) mais **n'interdit rien** ; « ← Retour » (pile de 20 liens `M.go`).
- Statuts affichés : badges de compteur par onglet (rouge `bg-red` si `hot`, gris sinon) : compteur de la première page en alerte.
- Messages : toasts ; aucune erreur de permission modélisée (les droits « masquent seulement les menus », constat de l'existant ; la cible exige un contrôle côté serveur, cf. asis de Paramétrage).
- États : vide/chargement/erreur : aucun spécifique (voir §1).
- Données MOCK observées : 3 sites dont Nanterre (Bus) `cible: true` ; 10 ateliers ; badges calculés (palettes à contrôler, unités en attente, colis clos…).
- Questions : matrice rôle → écran autorisés (la maquette ne fait que griser) ; droits d'écriture par rôle (sauf « Valider » réservé Coordination, et Commerce lecture seule) ; comportement tablette (DESIGN §8 : douchette) ; repli des onglets sous 992 px « non fait ».

### ECR-NAV-02 — Aperçu navigation haut (maquette de navigation V1.2)
- Fichier source : `apercu-navigation-haut.html` (284 Ko, statique, « aucun script, aucun clic », généré le 14/10/2026 à partir de la V2, CSS inline, graphiques ECharts en SVG figé).
- Accès : fichier autonome (document de décision), pas dans l'application.
- Structure : titre « Onglets en haut, sur le modèle du menu de Circé actuel » ; A. écran Suivi › Suivi de production (« Dashboard » : onglets internes) ; B. un onglet déroulé (Trains : Trains, Suivi par thème, Suivi 8 m²) ; C. « Plan des onglets » : tableaux Entrée du menu de Circé actuel → Page ouverte dans la maquette → Statut, pour chaque onglet (Suivi, Réception, 2m² fixe, Pliage, Trains, Bus (cible), Expedition ext, Administration).
- Contenu notable : 7 onglets de Circé actuel + Bus ; entrées « pas encore dans la maquette » ; entrées remplacées : « Déblocage » → « Rendre la main », « Écarts » → « Annule et remplace » ; Admin : Admin Equipe, Admin Machine, utilisateurs/données/menus (« droits : phase 4 ») ; « Rafraichir un dossier ». Précise : « L'accueil devient une icône maison » (supprimé depuis), « Ce choix remplace la règle un menu par processus de DESIGN.md ».
- Tableaux / filtres / formulaires / actions / messages : sans objet (page statique).
- Statuts affichés : colonne « Statut » des tableaux de plan (ex. « Pas encore dans la maquette »).
- États : sans objet.
- Données MOCK : tableaux de 30 lignes (« 30 lignes ») ; contenu figé de la V1.2.
- Questions : à ne pas utiliser comme cible (obsolète : 7 onglets, « validation unique », sous-onglets internes interdits depuis 14/10 soir). Utile uniquement pour la correspondance **menu Circé actuel → écran maquette** (aide à l'écart existant/cible).

---

## 3. Pilotage

### ECR-PIL-01 — Dashboard (Pilotage › Suivi de prod)
- Fichier source : `screens/suivi.js` (fonction `dashboard`, `M.screen id:'suivi'` sans `?pour`), `charts.js`.
- Accès : onglet Pilotage › Suivi de prod ; page d'ouverture ; logo. Rôles principaux : coord, cheq, admin, com.
- Structure : en-tête « Pilotage · Suivi de prod / Dashboard » ; barre de filtres **sous l'en-tête** (pilote aussi les graphiques) ; rangée 1 : tuile héros « Avancement » (grand pourcentage C/A, jauge, légende « C / A : n unités colisées ou expédiées sur n à produire ») + 4 tuiles ; 2 graphiques ECharts côte à côte (Avancement par atelier ; Avancement par départ camion) ; 2 cartes (Reste à recevoir par annonceur, 8 premiers ; Alertes du périmètre, 8 max) ; carte « Visuels qui bloquent la production » (tableau).
- Tableaux : « Visuels qui bloquent » : Visuel (bouton photo + « Annonceur · thème », texte), Dossier (texte), Atelier (« libellé · site »), Reste à recevoir (num), Unités bloquées (num), Livraison prévue (date « jeu. 15/10 » ou « Print Cityz : à demander » si `print`), État (pastille réception : Reçu, Partiel, Non reçu, Surplus > 10 %, Sans attendu). Tri par unités bloquées décroissant ; hauteur max 340 px ; export `.xlsx` ; ligne cliquable → fiche dossier (PIL-04).
- Filtres : N° de dossier, Départ, Atelier (multi), Format, Annonceur (smart), « + Filtre » Destination (destinataire · boucle).
- Formulaires : aucun.
- Actions : tuile « Reste à recevoir » et « En attente (A − B) » → `reservations?ou=AFFICHES,PARTIEL` ; clic sur une barre « atelier » → filtre Atelier posé ; « Voir en tableau/graphique » (vue tableau de chaque graphique) ; alertes : « Ouvrir » (lien de l'alerte), « Toutes les alertes » → `alertes` ; ligne bloquante → fiche dossier.
- Statuts affichés : étapes ECharts (rampe bleue) : En attente d'affiches `#86b6ef`, Prêt à produire `#5598e7`, En production `#2a78d6`, Colisé (scanné) `#1c5cab`, Expédié / livré `#0d366b`. Gravités d'alerte critical/serious/warning/info.
- Indicateurs : Avancement (C/A) ; Reste à recevoir (`reçu / attendu entretien compris`) ; OK pour production (B) ; En attente (A−B) ; Terminées (C, « scannées au colisage »). A = total des unités (train, UM, lot), B = prêt+prod+colisé+expédié, C = colisé+expédié.
- Messages : « Aucune alerte. », « Rien à afficher pour ces filtres. », vue tableau.
- États : vide présent ; chargement/erreur absents.
- Données MOCK observées : unité = train (`TR-0001`), UM fixe (`UM-…`), lot pliage (`PL-…`) / bus (`BU-…`) ; 4 semaines S42-S45 ; départ camion = destinataire × semaine (`jour/hh/mm` depuis lundi de S-1) ; barre claire = départ à risque.
- Questions : définition exacte de A/B/C pour le Bus et le pliage (lot ?) ; faut-il compter les trains multipliés par `nb` (la maquette somme `nb`) ; source réelle de « Livraison prévue » (Print Cityz).

### ECR-PIL-02 — Suivi de prod d'un atelier (en tête des onglets Déroulant, 2 m² fixe, Pliage, Bus)
- Fichier source : `screens/suivi.js` (`vueAtelier`), même écran `suivi` avec `?pour=deroulant|fixe|pliage|bus`.
- Accès : première entrée de chaque onglet d'atelier. Si aucun atelier du type sur le site choisi : encadré info « Pas d'atelier « X » sur ce site. Choisissez « Tous les sites »… ».
- Structure : en-tête (titre « Suivi de prod · <Déroulant|2 m² fixe|Pliage|Bus> », sous-titre) ; filtres dans le tableau ; 5 indicateurs ; annotation ; tableau.
- Tableaux (8 visibles) : Dossier (texte), Visuel (Annonceur · thème, bouton visuel), Départ (`S43+S44`), Attendu (num, entretien compris, calculé à l'afficheur), Reçu (num), « <Trains|UM|Lots> à produire » (num), Faits (num), Reste à faire (num). Masquées : Avancement (pastille), Atelier, Reste à recevoir, Réception (pastille), « en attente », Annonceur, Thème, Format, Attendu sans entretien ; Déroulant : Demies haut / bas / 8 m² finales ; puis Destinations (« Centres bus » pour Bus), Expédiés (« Remis au dépôt » pour Bus), Preuve de livraison, IP saisies (Oui/Non), Statut pré-production. Pied : totaux. Sélection + « Exporter la sélection » (xlsx).
- Filtres : N° de dossier, Départ, Atelier, Annonceur, Avancement (En attente d'affiches, Prêt ou en production, Terminé, Pas encore d'unité) ; « + Filtre » Format, Destination (« Centre bus » pour Bus).
- Formulaires : aucun.
- Actions : ligne → fiche dossier ; indicateurs → filtre Avancement ; export.
- Statuts affichés : Avancement : attente (critical) / cours (info) / terminé (good) / sans (info) ; Réception : Reçu / Partiel / Non reçu / Surplus / Sans attendu ; liseré : critical si MANQUANT et départ ≤ 43, serious si manquant/partiel, warning si surplus, good si reste à faire = 0.
- Indicateurs : <Trains> à produire (A) ; OK pour production (B) ; En attente (A−B) ; Terminés (C) ; Avancement C/A.
- Messages : « Aucun visuel avec ces filtres. »
- États : vide présent ; chargement/erreur absents.
- Données MOCK : 8 m² : `d8 {haut,bas,final}` ; `livraisonPrevue` seulement si `print` ; une ligne par thème (`TH1…`) d'un dossier (`910037`, 6 chiffres = 910000 + seq×37).
- Questions : les colonnes « Demies » dépendent du suivi 8 m² (écran Trains, autre agent) ; règle du compteur « Faits » = unités colisées ou expédiées.

### ECR-PIL-03 — État des réservations vivant
- Fichier source : `screens/reservations.js` (`id:'reservations'`), `data.js` (`C.base`, `C.ouLigne`).
- Accès : Pilotage › État des réservations vivant ; tuiles du dashboard ; liens `?ou=`, `?dossier=`, `?par=`, `?q=` ; rôles coord, admin, recep, com, cheq.
- Structure : en-tête (« Tous les dossiers dont la DA est activée, pour les départs … ») ; barre de filtres avec sélecteur « Afficher par » ; 5 indicateurs ; annotation « Une base, des vues (21/10) » ; ligne éventuelle « n ligne(s) sans ce grain » ; tableau.
- « Afficher par » (grain, 9 valeurs) : Dossier ; DA (dossier × type de réalisation × plateforme) ; Thème (défaut) ; Destinataire (× thème) ; Afficheur (× destinataire × thème) ; Unité (train, UM, lot) ; Colis ; Départ camion (destinataire × semaine) ; Format (tous dossiers).
- Tableaux : base unique à ~35 colonnes, 8 visibles selon le grain (ex. Thème : Dossier, Visuel, Départ, Où en est-il, Attendu, Reçu, Reste à recevoir, N° d'affiche). Colonnes disponibles : Dossier, Visuel, Annonceur, Thèmes (num), Dossiers (num), Départ, Destinataire, Afficheur, Unité (+ tag train/UM/lot), Statut de l'unité, Unités, Colis, Statut du colis, Départ camion (date-heure), Boucle (boucle · canal), Où en est-il (pastille), Attendu, Reçu (tag « thème entier »), Reste à recevoir, Couvert par le stock, Reste à faire, Dont entretien, Faites, Expédiées, Livrées (preuve), Format, Atelier, Type de réalisation, Plateforme, Pré-production (Broadcast), Validation admin, Affiche reçue, N° d'affiche, Repères (Contrôlée, Print Cityz, Reste en place, Ne pas afficher, Multi-semaines), Pôle, DA. Totaux en pied (reçu et reste comptés une fois par thème). Sélection + « Exporter la sélection ». Ligne → fiche dossier si 1 dossier.
- Filtres : N° de dossier ; Départ ; Atelier ; Où en est-il (10 valeurs) ; Annonceur ; « + Filtre » : Affiche reçue (Oui/Partielle/Non), Repère, Format, Pôle, Destinataire. Les filtres portent sur les lignes fines puis regroupement.
- Formulaires : aucun.
- Actions : tuiles → filtre « Où en est-il » ; changement de grain ; export ; clic ligne → fiche.
- Statuts affichés : **Où en est-il** (OU) : DA activée, IP à saisir (warning) → IP saisies, prépa attendue (info) → Prépa reçue, affiches attendues (critical) → Affiches reçues en partie (serious) → Affiches reçues, validation admin à confirmer (serious) → Prêt ou en production (info) → Produit, à expédier (good) → Expédié (good) → Livré (preuve reçue) (good) ; Annulé (info). **Pré-production (Broadcast)** : DA activée IP à saisir / IP saisies prépa attendue / Prépa reçue / Annulé. **Validation admin du dossier** : À confirmer (n) (serious) / Validée (good) / Aucune affiche reçue (info) / « — » (annulé). **Affiche reçue** : Oui (good) / Oui, surplus (warning) / Partielle (serious) / Non (critical) / Sans attendu (warning) / « — ». Liseré critical si DA ou IP après deadline PP ou AFFICHES pour départ ≤ semaine en cours.
- Indicateurs (phases) : Dossiers (DA activée, hors annulés) ; En pré-production (DA/IP/PREPA) ; Affiches attendues (AFFICHES/PARTIEL) ; En production ; Produits ou expédiés (PRODUIT/EXPEDIE/LIVRE). Un dossier compte à l'étape la moins avancée de ses lignes.
- Messages : « Aucune ligne avec ces filtres à ce grain. » ; mention « n ligne(s) sans destinataire (préparation pas encore reçue) ».
- États : vide présent ; chargement/erreur absents.
- Données MOCK : dossier à deux plateformes : id `…-W` avec `no` = id du dossier mère et même `da` (968 affiches Nîmes, 1 433 Wissous d'après les commentaires) ; avant IP : ligne DA sans thème (`typeReal` ex. « 118,5 × 175 », « 320 × 240 recto verso 150 g ») ; quantité d'un dossier sur 2 semaines comptée une fois (ANO-02) ; N° d'affiche `712xxx` avec ✓ (confirmée) / • (proposée).
- Questions : Q41 (21/10) « le reçu ne se répartit pas par destinataire » ; règle de couverture « départ le plus proche servi d'abord » (`C.couverture`) à confirmer ; grain « DA » (dossier × type de réalisation × plateforme) vs données réelles de Broadcast ; volumétrie réelle (S à S+8 d'après l'existant) ; périmètre de la copie Broadcast.

### ECR-PIL-04 — Fiche dossier (tiroir partagé)
- Fichier source : `screens/suivi.js` (`ui.dossierDrawer`), réutilisé par PIL-01, 02, 03.
- Accès : clic sur une ligne de tableau (si 1 dossier).
- Structure : panneau latéral droit « <Annonceur> · dossier <id> » : pastille statut dossier + tags (atelier · site, format, Départ S43 + S44, Print Cityz, Campagne contrôlée, Arrivé après libération) ; ligne « DA n · pôle · entretien n % · IP saisies/non · préparation reçue le … » ; tables mini : Visuels (Pos., Thème, Attendu, Reçu, Reste, État), Préparation par destinataire et afficheur (Destinataire, Afficheur, Thème, Qté, Entretien), Unités de production (Unité, Destinataire, Nb, Statut), Affiches reçues (N° affiche, Réception, Reçu, Emplacement, Le) ; Historique (frise) ; boutons « Voir dans Instructions » (→ `instructions?q=`) et « Voir les affiches » (→ `reception?tab=affiches&q=`).
- Statuts : pastille dossier, états de visuels, statuts d'unité.
- Messages : « Préparation pas encore reçue de Broadcast. »
- Données MOCK : `historique` du dossier fusionné avec le journal (`objet === d.id`).
- Questions : la fiche affiche IP « saisies » mais pas l'état de la validation admin (alors que celle-ci est dans l'EDR) ; contenu cible à valider.

---

## 4. Vérification des thèmes (onglet Pré-production)

Écran unique `themes` à 3 vues (`?tab=proches|annonceurs|bc`), rôles `coord`, `admin`. Besoins : PP-08, PP-09, ANO-07, REC-23, BC-03, SCR-08. Règle de proximité (`C.proches`) : intitulés simplifiés (minuscules, sans accents ni ponctuation) identiques, ou l'un contenu dans l'autre (≥ 3 caractères, mots entiers), ou similarité (ratio d'une plus longue sous-chaîne commune récursive) ≥ **0,85** (paramétrable). Groupage par annonceur de référence (regroupement `*MISTRAL*` ou groupe d'annonceurs proches non « différents »).

### ECR-THM-01 — Thèmes proches entre dossiers
- Fichier source : `screens/themes.js` (`vueProches`, `demander`, `differents`, `rouvrir`, `detailGroupe`).
- Accès : Pré-production › Vérification des thèmes › Thèmes proches ; alertes ; `?dossier=`.
- Structure : en-tête, filtres, 4 indicateurs, annotation (règle), tableau, encadré cible « À voir avec les Coordinations (Q19, Q39) ».
- Tableaux : État (pastille), Annonceur, Intitulés trouvés (boutons visuel + « Menu burger » ×2 · « MENU BURGERS »), Dossiers (liste), Départ, Pré-production (pastilles « statut (n) ») ; masquée : Ateliers. Export xlsx ; ligne → modale détail.
- Filtres : N° de dossier, Départ (≥ semaine en cours), État (défaut **À vérifier**), Annonceur ; « + Filtre » Atelier.
- Formulaires : modale « Demander la correction dans Broadcast · <annonceur> » : radio de l'intitulé correct (le plus fréquent préselectionné, avec nb de thèmes et dossiers), tableau « À corriger dans Broadcast » (Dossier, Atelier, Statut pré-production, Correction demandée « ancien → **nouveau** », mention : « Production lancée : à voir avec l'atelier » / « prépa pas encore envoyée : à corriger dans les IP » / « mail au gestionnaire, préparation à renvoyer »), champ texte « Message au gestionnaire (facultatif) ».
- Actions : « Demander la correction » (primaire) → modale → « Envoyer la demande (mail au gestionnaire) » : crée une demande par thème (`demandesThemes[themeId] = {statut:'ENVOYEE', ref, ancien, date, user, note}`), historise le dossier, journalise, envoie **un mail par pôle** (« Gestionnaires <pôle> (Broadcast) », objet `[Circé] Thème à corriger dans Broadcast : <annonceur> (<dossiers>)`), **sans changer l'état du dossier** ; refus si production lancée sur tous les dossiers (« Rien à demander… Voir avec l'atelier ») ; « Visuels différents » → verdict `DIFFERENTS` (toast « L'alerte est levée ») ; « Rouvrir » ; ligne → modale détail (« Ouvrir le dossier » → `instructions?statut=TOUS&q=`).
- Statuts : À vérifier (warning), Demande envoyée à Broadcast (serious), Corrigé par Broadcast (good), Visuels différents (info), Même intitulé (info).
- Indicateurs : À vérifier ; Demandes envoyées ; Même intitulé (une affiche pour plusieurs dossiers, S31) ; Déjà traités.
- Messages : « Demande envoyée pour n dossier(s) : mail au gestionnaire… » ; « Noté : ce sont des visuels différents. L'alerte est levée. » ; vide : « Aucun thème proche à vérifier avec ces filtres. »
- États : vide présent ; chargement/erreur absents.
- Données MOCK : cas `Fromagerie Lacombe` « Automne gourmand » / « automne gourmand 16 oct » ; thèmes `TH…` ; groupe clé = ids de thèmes triés ; le groupe disparaît quand Broadcast renvoie la préparation (simulation « Broadcast renvoie les préparations corrigées »).
- Questions : Q19 (écran dans Broadcast ou Circé ?), Q39 (process différent fixe/déroulant), canal de la demande (mail à confirmer) ; que faire si production lancée (aujourd'hui : refus) ; comparer par annonceur, annonceurs proches ou tous dossiers ?

### ECR-THM-02 — Annonceurs proches
- Fichier source : `themes.js` (`vueAnnonceurs`, `demanderAnnonceur`, `differentsA`, `rouvrirA`, `detailAnnonceurs`).
- Accès : Pré-production › Vérification des thèmes › Annonceurs proches.
- Structure : en-tête, filtres, 3 indicateurs, annotation, tableau.
- Tableaux : État, Noms trouvés (« Brasserie du Port » · « BRASSERIE PORT »), Dossiers, Départ, Origine (Broadcast / Broadcast et plateforme), Pré-production.
- Filtres : N° de dossier, Départ, État (défaut À vérifier).
- Formulaires : modale « Demander la correction de l'annonceur » : radio bon nom, tableau À corriger (Dossier, Atelier, Statut, Correction, Où : « dans Circé (nom imprimé) » / « Production lancée : main non rendue » / « Broadcast, avant l'envoi de la prépa » / « Broadcast : mail envoyé, préparation à renvoyer »), message facultatif.
- Actions : « Demander la correction » : pour la source Broadcast → demande + mail au gestionnaire du pôle ; pour la source Plateforme (fixe/colle) → alignement du nom imprimé dans Circé (`t.annonceurImprime`) ; « Annonceurs différents » (les thèmes ne sont plus comparés entre eux) ; « Rouvrir ». Aucun regroupement ajouté par Circé.
- Statuts : À vérifier, Demande envoyée à Broadcast, Corrigé par Broadcast, Annonceurs différents.
- Indicateurs : À vérifier ; Demandes envoyées ; Déjà traités.
- Messages : « Demande envoyée pour n dossier(s) ; n nom(s) imprimé(s) aligné(s)… » ; « Noté : ce sont des annonceurs différents… » ; vide : « Aucun annonceur proche à vérifier avec ces filtres. »
- États : idem.
- Données MOCK : dossiers `MISTRAL Nîmes` / `MISTRAL Vence` (réunis par le regroupement → non signalés) ; clé de groupe = n° de dossiers joints par `|`.
- Questions : portée de la règle (dès DA activée, y compris non reçus) ; qui corrige le nom imprimé.

### ECR-THM-03 — Thèmes modifiés dans Broadcast
- Fichier source : `themes.js` (`vueBC`, `M.appliquerThemeBC`).
- Accès : Pré-production › Vérification des thèmes › Thèmes modifiés dans Broadcast ; alertes `THEME_BC`.
- Structure : en-tête, filtres, 3 indicateurs, annotation, tableau, encadré cible « À décider ».
- Tableaux : Gravité (pastille Production lancée / Avant la production), Dossier, Annonceur, Atelier, Départ, Thème dans Circé (visuel + texte), Thème dans Broadcast (gras) ; masquées : Modifié le, Statut pré-production.
- Filtres : N° de dossier, Départ, Production (lancée/avant), Annonceur ; « + Filtre » Atelier.
- Formulaires : aucun.
- Actions : « Reprendre la version BC » (primaire) → `t.libelle = t.libelleBC`, historise, journalise, appelle `C.noterThemeModifie` (feuille de stock à refaire côté Réception) et, si production lancée, mail aux chefs d'équipe de l'atelier (`[Circé] Thème changé par Broadcast, production lancée : dossier …`) ; « Voir le dossier » → `reservations?dossier=`.
- Statuts : Production lancée (critical), Avant la production (serious).
- Indicateurs : Thèmes modifiés dans Broadcast ; Production lancée ; Avant la production.
- Messages : « Thème « … » repris de Broadcast pour le dossier … Production lancée : l'atelier est prévenu. » ; vide : « Aucun thème modifié dans Broadcast avec ces filtres : Broadcast et Circé ont les mêmes thèmes. »
- États : idem.
- Données MOCK : `t.libelleBC` + `t.modifBC {date, ancien}` ; produit par la simulation « Broadcast change un thème après la validation ».
- Questions : reprise automatique ou après clic ? (encadré « À décider ») ; qui prévient l'imprimeur quand le visuel change réellement ; fréquence de la comparaison (à chaque mise à jour de la copie Broadcast).

---

## 5. Stocks

### ECR-STK-01 — Stock par affiche
- Fichier source : `screens/stock.js` (`id:'stock'`, `?tab=stock`), rôles recep, cheq, expe. Besoins QUA-01, REU-08, PROC-03, REC-08, REC-24.
- Accès : Stocks › Stock › Stock par affiche.
- Structure : en-tête, filtres, 4 indicateurs, annotation, tableau.
- Tableaux : N° affiche (`712xxx`), Visuel (Annonceur · thème + tag « à conserver »), Départ (`S43+S44`), Emplacement (allée-rayon, avec site), Reçu (num), Sorties expédition (num), Disponible (num + pastille « n rebut »), Dernière sortie auto (date) ; masquées : Site, Annonceur, Thème, Rebut, À conserver. Export xlsx ; sélection ; liseré muted si dispo ≤ 0, info si à conserver.
- Filtres : N° de dossier, Départ (une affiche sans semaine reste visible), Format, État (En stock, Épuisée, À conserver (reliquat), Avec du rebut) ; « + Filtre » Allée.
- Formulaires : modale « Mise au rebut (n affiche(s)) » : Quantité par affiche (nombre, min 1, défaut 1) ; Motif (liste : Affiche déchirée, Mauvais visuel, Erreur de quantité, Autre).
- Actions : actions groupées : « Mettre au rebut » (destructif, rouge) → mouvement `Mise au rebut` négatif plafonné au disponible ; « Marquer « à conserver » » → `aConserver = true`.
- Statuts : états d'affiche (En stock / Épuisée / À conserver / Rebut) ; pastille serious « n rebut ».
- Indicateurs : Affiches en stock ; Reliquats d'entretien à conserver (n visuels) ; Rebut ; Sorties automatiques aujourd'hui (à l'expédition).
- Messages : annotation (le disponible baisse automatiquement à la fin de journée Geodis) ; pas de toast explicite de rebut.
- États : pas de message vide spécifique (tableau vide standard) ; chargement/erreur absents.
- Données MOCK : affiche `712001…` ; mouvements `MV-1001…` ; rebut 1-3 sur ~1 affiche sur 9 parmi 60 ; affiches du S42 encore en stock marquées `aConserver`. Stock = somme des mouvements.
- Questions : QUA-03 non-conformité (seul un lien vers « Process Métier » évoqué, à cadrer) ; « Marquer à conserver » n'a ni motif ni durée ici (voir STK-03) ; distinction rebut / destruction (même case `rebus` dans l'existant) ; pas d'entrée manuelle ni de saisie de stock ; pas de motif obligatoire du rebut.

### ECR-STK-02 — Mouvements de stock
- Fichier source : `stock.js` (`?tab=mvt`).
- Accès : Stocks › Stock › Mouvements ; Parcours « Expédier et mettre à jour le stock ».
- Structure : en-tête, filtres, mêmes 4 indicateurs que STK-01, tableau.
- Tableaux : Date (date-heure), N° affiche, Mouvement (Réception, Expédition C-…, Mise au rebut, Renvoi avant destruction, Destruction), Quantité (num signé), Par, Automatique (« Oui » / vide), Motif. Tri date décroissante. Liseré info si automatique, serious si rebut.
- Filtres : N° de dossier, Mouvement, Automatique (Oui (à l'expédition) / Non) ; « + Filtre » Par.
- Actions : export seulement (journal, aucune action de ligne).
- Statuts : aucun badge ; type et signe.
- Messages / États : vide générique.
- Données MOCK : `Expédition C-0000000000063xxxx` (type = « Expédition » + code colis), user `Circé (automatique)` pour auto ; `Réception` par `Contrôleur A…D`.
- Questions : durée de conservation de l'historique ; mouvement d'ajustement/inventaire absent ; sorties automatiques calculées par thème sur besoins des unités du colis (`C.sortiesExpedition`) : règle de répartition entre plusieurs affiches d'un même thème à valider.

### ECR-STK-03 — Fin de campagne
- Fichier source : `screens/fincampagne.js` (`id:'fincampagne'`), rôles recep, cheq, coord. Besoins REC-24, REC-20, REC-21.
- Accès : Stocks › Fin de campagne ; badge = nombre « À décider » ; lien `?decision=` (A_DECIDER, CONSERVER, ENVOYER, DETRUIRE, FAIT).
- Structure : en-tête (titre dynamique : « À décider », « Sortis du stock »…), filtres, 4 indicateurs, annotation (règles de délai), tableau, encadré cible « À confirmer en atelier ».
- Tableaux : Décision (pastille), Dossier, Annonceur, Atelier (· site), Dernier départ (`S41`), En stock (num), Détail (texte : « Proposition : Conserver : campagne prévue S44 (dossier …) » / « Détruire dès S45 » / « Jusqu'à S52 · motif » / « n affiche(s) à renvoyer à … » / « Renvoyé le … » / « Détruit le … (n) »), Attention (pastilles BDX n %, MUI (Ville de Paris), « campagne prévue ») ; masquées : Délai avant destruction (« 4 sem. (2 m²) »), Destruction (« ? », Non, Oui, Oui après le renvoi), Emplacements, Site. Sélection ; export.
- Filtres : N° de dossier, Décision (défaut À décider), Point d'attention (Bordeaux, MUI (Ville de Paris), Visuel encore utilisé, Aucun), Site (hors Nanterre) ; « + Filtre » Annonceur.
- Formulaires : modale « Fin de campagne · dossier <id> · <annonceur> » : choix radio Détruire / Renvoyer, puis détruire le reste / Conserver ; Renvoyer : Destinataire (Client ou agence, Ville de Paris, Dépôt <destinataire>, Autre plateforme, Autre) + Quantité à renvoyer (1..stock) ; Conserver : Jusqu'à (S+1 à S+10) + Motif (Campagne prévue sur le visuel, Ville de Paris (MUI), Réaffichage prévu, Demande du client, Autre) ; avertissements : « Destruction non proposée : le visuel sert encore » (garde-fou, radios Détruire et Renvoyer désactivées) ; « Point d'attention… décision dossier par dossier, sans destruction en lot ». Modale « Confirmer la destruction » : coche obligatoire « Je confirme que toutes les affiches restantes de ces dossiers ont été détruites ».
- Actions : « Décider… » (primaire) → modale ; « Enregistrer la décision » (refus si garde-fou et choix ≠ conserver : toast critique) ; « Revenir à « à décider » » ; « Renvoi fait » → mouvement `Renvoi avant destruction` négatif (stock restant → « À détruire », sinon « Renvoyé ») ; « Destruction faite… » → coche → mouvement `Destruction` pour tout le stock, décision `DETRUIT` ; « Modifier » (conserver). Actions groupées : « Détruire la sélection » (uniquement dossiers « à décider », sans point d'attention ni garde-fou ; les autres sont laissés de côté avec message) et « Destruction faite… » (dossiers « à détruire »).
- Statuts : À décider (warning), À conserver (info), À renvoyer puis détruire (serious), À détruire (critical), Renvoyé (good), Détruit (good).
- Indicateurs : À décider (n avec point d'attention), À conserver (n affiches), À renvoyer, À détruire.
- Messages : « Dossier <id> : à détruire. », « Le visuel a encore une campagne prévue : seule la conservation est possible. », « Cochez la confirmation de destruction. », « Destruction faite : n affiche(s), n dossier(s). Le stock est à zéro. », « Rien à détruire en lot : … », vide « Aucun dossier avec ces filtres. »
- États : vide présent ; chargement/erreur absents.
- Données MOCK : dossier en fin de campagne si `dernier départ < semaine en cours` et stock > 0 ou décision existante ; délais : 2 m² (MUI compris) 4 semaines, 8 m² 2 semaines (faute de place), autres 4 ; BDX = au moins une ligne vers Bordeaux (`BOR`) ; MUI = format « Scrolling MUI » ; garde-fou = un autre dossier (non annulé, semaine ≥ en cours) utilise la même affiche ; la décision est stockée par dossier (`M.data.finCampagne[id]`).
- Questions : décision par dossier (cheffe de projet) ou par visuel (RP32 #4) ; critère réel de BDX ; destinataire du renvoi hors Paris ; qui décide (réception, Coordination, commerce) ; coche de confirmation à valider ; correspondance avec l'existant « Suivi › Etat de destruction » (affiches entrées depuis plus d'un an, conservation ≥ 365, dernier départ > 4 semaines).

---

## 6. Expédition

Écran `expedition`, rôles expe, cheq ; filtres communs aux 3 vues (`F`) ; besoins REU-08, CIB-15, QUA-01, EXP-01 à 03.

### ECR-EXP-01 — Scan et colisage
- Fichier source : `expedition.js` (`tabColisage`, `scanner`, `retirer`, `clore`).
- Accès : Expédition › Scan et colisage (vue par défaut) ; Parcours 9.
- Structure : en-tête, filtres, 4 indicateurs, annotation, bandeau « ⌁ Douchette » (champ de saisie), grille 2 colonnes : carte « Unités produites à coliser » (par destinataire, ou « À coliser pour <destinataire> ») ; carte « Colis en cours ».
- Tableaux : liste (non Tabulator) : par destinataire : nom, boucle · départ (jour + heure), nb d'unités, bouton « Scanner le destinataire » ; pour un destinataire : code unité (mono), positions (train) ou thème, afficheur, bouton « Scanner ».
- Filtres : N° de dossier, Départ, Boucle ; « + Filtre » Statut du colis (masqué sur cette vue), Canal (Milk run Geodis, Messagerie Geodis, Remise directe), Destinataire.
- Formulaires : champ scan : saisir un code destinataire (id `BOR`/libellé) ou unité (`UM-0001`, `TR-0001`) + Entrée. Colis en cours : cases à cocher par unité.
- Actions : scan destinataire (fixe `E.dest`) ; scan unité : refuse si code inconnu (« Code inconnu : X »), si unité non « Produit » (« … n'est pas « Produit » (statut : …) »), si destinataire différent (« contrôle bloquant ») ; ouvre le colis au premier scan (statut `COLIS_OUVERT`, unité → `COLISE`) ; « Clore le colis » (primaire) → `COLIS_CLOS` ; modale « Étiquette Geodis messagerie » (« GEODIS EXPRESS ») ou « Colis milk run clos » (« MILK RUN · <boucle> ») avec code colis, destinataire, nb unités, départ ; « Retirer la sélection » / « Tout retirer » → unités redeviennent « Produit », colis vidé supprimé ; un colis clos ne se rouvre pas (décision 16/10).
- Statuts : Produit → Colisé · à expédier ; colis Ouvert / Clos.
- Indicateurs : Produites à coliser ; Colis clos à expédier ; Expédiées ; Livrées (preuve reçue).
- Messages : toasts « <unité> ajouté au colis <code> (n train(s) / n affiches). » ; « Cochez les unités à retirer du colis. » ; vides « Aucune unité produite en attente de colisage. », « Plus rien de produit pour ce destinataire. », « Aucun colis ouvert. Le premier scan d'unité ouvre un colis. »
- États : vide présent ; chargement/erreur absents (les erreurs de scan = toasts critiques).
- Données MOCK : code colis `C-0000000000063` + n° (4101…) ; unités `TR-0001`, `UM-…` ; max 8 trains / 12 UM par colis généré ; canal MILK / MESSAGERIE / DIRECT (bus) ; départ camion calculé depuis le destinataire (jour/hh/mm).
- Questions : format réel du code colis Geodis ; étiquette réelle (aujourd'hui simulée) ; scan physique (douchette) vs saisie ; que faire d'un rouleau oublié (nouveau colis) ; contrôle de destination bloquant : source de vérité ; multi-agents simultanés (un seul `E.colis` global en maquette).

### ECR-EXP-02 — Colis
- Fichier source : `expedition.js` (`tabColis`, `finDeJournee`).
- Accès : Expédition › Colis.
- Structure : bandeau (annotation + bouton principal « Fin de journée Geodis »), filtres, 4 indicateurs, tableau.
- Tableaux : Code colis, Départ (`S43`), Destinataire, Boucle Geodis (boucle · canal), Unités (num), Statut (pastille), Récépissé Geodis, Preuve de livraison (pastille good + date-heure ou « — ») ; masquées : Canal, Clos le, Expédié le. Tri par statut asc ; liseré info (clos), warning (ouvert). Export xlsx.
- Filtres : N° de dossier, Départ (un colis non livré passe toujours le filtre), Boucle ; « + Filtre » Statut du colis (Colis ouvert, Clos · à expédier, Expédié, Livré), Canal, Destinataire.
- Actions : « Fin de journée Geodis » → tous les colis `COLIS_CLOS` du périmètre passent `EXPEDIE` (récépissé `906xxxxx`), unités → `EXPEDIE`, sorties de stock automatiques ; journal « Fin de journée : n colis expédiés, sorties de stock automatiques ». Simulation séparée « Preuves de livraison Geodis reçues » (menu Simuler) : colis `EXPEDIE` → `LIVRE`.
- Statuts : Colis ouvert, Clos · à expédier, Expédié, Livré (H9 : Livré à la réception de la preuve, Expédié à la fin de journée).
- Messages : toast « n colis pris en charge par Geodis. Stock mis à jour automatiquement. » ; « Aucun colis clos à expédier dans ce périmètre. »
- États : vide générique.
- Données MOCK : récépissé `905xxxxx` (S42) / `906xxxxx` ; preuve = expédition + 14-30 h.
- Questions : Geodis API réelle (le batch actuel n'enregistre jamais son résultat, DEM-007) ; qui déclenche « fin de journée » (manuel ici, automatique cible ?) ; heure limite ; reprise après échec.

### ECR-EXP-03 — Départs camions
- Fichier source : `expedition.js` (`tabDeparts`).
- Accès : Expédition › Départs camions.
- Structure : en-tête, filtres, indicateurs, annotation, tableau (sans recherche ni compteur de colonnes).
- Tableaux : Départ (jour + heure), Boucle (· site si tous sites), Destinations (texte), Unités (num), Colisées / parties (num), En cours (num), En attente d'affiches (num), Avancement (jauge) ; masquée Plateforme. Exclut le site Nanterre (Bus). Liseré critical si unités en attente et départ < 36 h, warning si en attente, good si tout prêt.
- Filtres : mêmes que EXP-01.
- Actions : aucune (lecture).
- Statuts : jauge d'avancement ; gravité par liseré.
- Données MOCK : 6 boucles Nîmes/Wissous (Sud-Ouest, Rhône-Alpes, Sud-Est, Messagerie express, IDF, Ouest, Normandie, Nord, Centre) ; horaires par destinataire (ex. Bordeaux jeudi S-1 16h30, Lyon vendredi 10h00).
- Questions : horaires réels et paramétrage (voir ADM-06) ; départs hors milk run ; bus (remise directe) exclus de la vue.

---

## 7. Générateur de fichiers de production

Écran `generateur` (rôle `cheq`), machine choisie dans le menu (`?machine=NIM-VEN|WIS-VEN|NIM-MR|WIS-MR`). Besoins FIX-02, FP-01, FP-02, SCR-06, SCR-07, CIB-09, CIB-10, ANO-13. Stepper (`steps`) 4 étapes. Filtre unique : **Départ**. Sans machine alimentée par fichier sur le site : encadré « Pas de machine alimentée par fichier sur ce site. » ; annotation : « CCM V2, assemblage 8 m² et tables de roulage passent par les bagues ; le pliage n'a pas de machine ».

### ECR-GEN-01 — Fichiers Vendôme : choix des trains
- Fichier source : `generateur.js` (`choixVendome`, `genererVendome`, `tiroirsDe`).
- Accès : Déroulant › Fichiers Vendôme › <machine> ; ou trains pré-cochés depuis Liste des trains/Préparation (`G.preselect`).
- Structure : étapes (1 « Trains choisis par le chef d'équipe » active) ; grille 2/3 – 1/3 : carte « Trains prêts : départs … » (tableau) ; carte « Règles appliquées » (tiroirs max, 3 indicateurs Prêts / En attente / Déjà envoyés, annotation) ; carte « Historique des générations » en bas.
- Tableaux : Train (`TR-0001`), Destinataire, Positions (pastilles A-D), Nb trains (num), Tiroirs (num : visuels distincts, positions fractionnées exclues), Départ camion (date-heure) ; masquée Afficheur. Sélection par case ; recherche.
- Filtres : Départ.
- Formulaires : sélection de trains (cases).
- Actions : barre d'actions sur sélection : compteur « n / 20 tiroirs », pastille critique « au-delà de 20 : bloquant », bouton « Préparer le fichier (n trains) » (désactivé au-delà de 20) → bilan GEN-03 ; toast critique « n tiroirs : la Vendôme en a 20. Retirez des trains (bloquant). » ; « Cochez les trains à mettre dans le fichier. »
- Statuts : unités PRET proposées ; EN_ATTENTE exclues ; EN_PROD déjà envoyées.
- Messages / États : vide « Aucun train prêt pour ces départs. »
- Données MOCK : `tiroirs: 20` ; nommage `S43_NIM_VEN_F01` ; générations `G-0412`, `G-0418`.
- Questions : format `.ini` exact de la Vendôme (phase 3, outil GenfichierProd/Caire) ; règle bloquante à 20 tiroirs vs 6 thèmes/train de l'existant (H5) ; ordre de composition (critères non utilisés en Vendôme dans la maquette).

### ECR-GEN-02 — Fichiers multi-rouleuse : source et règles
- Fichier source : `generateur.js` (`generer`, `genMultirouleuse`).
- Accès : 2 m² fixe › Fichiers multi-rouleuse › <site>.
- Structure : stepper (1 « Unités prêtes » active) ; 2 cartes : « Source : unités des départs … » (3 indicateurs Prêtes / En attente / Déjà envoyées) ; « Règles appliquées » (un fichier par annonceur regroupé et thème ; regroupements ; critères d'ordonnancement avec boutons Monter/Descendre ; bouton primaire « Proposer les fichiers ») ; historique.
- Tableaux : aucun (indicateurs).
- Filtres : Départ (ajouter S+1 pour anticiper : unités déjà prêtes de S+1 entrent dans la proposition).
- Formulaires : ordre des critères (train : « Train reçu à 100 % », « Destinataire (départ camion le plus proche) », « Jour de départ », « Nombre de tiroirs (≤ 20) », « Nombre d'affiches par tiroir » ; fixe/pliage : « Reçu », « Jour de départ », « Destinataire »).
- Actions : « Proposer les fichiers » (désactivé sans unité prête) → bilan GEN-03 ; réordonner un critère annule la proposition.
- Messages : « Aucune unité prête pour cette machine et cette semaine. »
- Données MOCK : cas démo `MISTRAL Nîmes/Vence` (regroupement `*MISTRAL*`), `Fromagerie Lacombe` (thèmes proches).
- Questions : encodage cp1252 sans en-tête (la maquette télécharge en UTF-8) ; règle colonne J (poids support vs Qté/4) ; répertoire de dépôt (« dossier jaune »).

### ECR-GEN-03 — Bilan de génération et envoi à la machine (+ historique)
- Fichier source : `generateur.js` (`resultat`, `preview`, `envoyer`, `historique`).
- Accès : après « Préparer / Proposer » (état en mémoire `G.result`).
- Structure : stepper (étape 3) ; 5 indicateurs ; encadré warning « Thèmes proches pour un même annonceur » (multi-rouleuse) ; grille 1/3 – 2/3 : « Bilan de génération » (cartes fichier cliquables, case « Combiner avec : … ») et « Aperçu du fichier » (nom, extension `.csv → .ini` pour Vendôme, structure de colonnes, 40 premières lignes, boutons « Télécharger ») ; pour Vendôme : « Liste de picking » (Tiroir, Annonceur, Thème, Quantité, Emplacement) ; boutons « Revenir au choix des trains » / « Abandonner la proposition », « Tout télécharger », « Envoyer à la machine (n fichiers) » (primaire) ; carte « Historique des générations ».
- Tableaux : Historique : Lot (`G-0412`), Date, Par (masquée), Machine, Départ, Fichiers, Unités, Modifiées depuis, Statut ; ligne critique si une unité a été modifiée par Broadcast après la génération ; action « Générer un complément » (uniquement les unités modifiées).
- Indicateurs : Fichier(s) préparé(s)/proposé(s) ; Trains / UM ; Affiches ; Tiroirs (n / 20, bloquant au-delà) ou Thèmes proches détectés ; Exclues (visuels manquants).
- Actions : « Envoyer à la machine » → unités `EN_PROD` (point de non-retour), `bague = true` (Vendôme), génération enregistrée (`G-xxxx`, statut « Envoyé à la machine », version 1), journal ; fusion des thèmes proches cochés ; « Générer un complément » → journal + toast.
- Statuts : Envoyé à la machine ; version.
- Messages : toast « n fichier(s) envoyé(s) à <machine>. n unité(s) « En production » (point de non-retour). Bagues incluses. » ; annotations sur le format.
- États : vide absent pour le bilan (non atteignable à vide).
- Données MOCK : lot `G-` + n° (420 + 3×n) ; nom de fichier fixe `S43 <annonceur 20> <thème 60>` ; lignes CSV simulées : Vendôme (TrainId;Format;Statut;Origine;Afficheur;Zone;Section;Adresse1;Adresse2;CentreCommercial;NbContrats;DateDépart;SupNom;Réf.;[Contrat;Réseau;Annonceur;Thème;Repiquage;Rouleur;Lettre]×n, 6 contrats max), multi-rouleuse (Thème;Qté;;UM;Dossier;Répart;Annonceur;Format;Type prépa;J;Afficheur;Destinataire;Adresse;Complément;Ville;CP).
- Questions : versionnage réel (« chaque lot est un lot versionné ») : nouvelle version ou complément ? droits d'envoi ; reprise sur incident machine ; dépôt réseau vs téléchargement.

---

## 8. Administration — Paramétrage

Écran `parametrage`, rôle `admin`, 8 vues (`?tab=`). Sous-titre commun : « Ajouter un format, un site ou une machine par paramétrage, sans développement. » Plusieurs réglages sont **fonctionnels en mémoire** (champs avec `onChange`), d'autres sont en lecture seule (marqués comme tels).

### ECR-ADM-01 — Sites, ateliers et gammes
- Source : `parametrage.js` (`tab: 'ateliers'`).
- Tableaux : « Ateliers par site » (Site, Atelier, Mode : Trains (déroulant) / Unitaire, Formats, Machines, tag « cible ») ; « Gammes de fabrication par mode » (5 gammes sous forme d'étapes fléchées : 2 m² déroulant sur Vendôme ; Déroulant hors Vendôme ; 2 m² fixe ; Colle/pliage (Wissous) ; Bus Nanterre (cible)).
- Encadré warning : « À confirmer : atelier « Nîmes Pliage 12M2 » et sites « DBG »/« DBG Lyon » dans le code, absents des decks ; colle à Wissous seulement ».
- Filtres/formulaires/actions : aucun (lecture seule, pas de CRUD).
- Données MOCK : 10 ateliers (`NIM-D2`, `NIM-F2`, `NIM-D8`, `NIM-D4`, `WIS-D2`, `WIS-F2`, `WIS-D8`, `WIS-D4`, `WIS-COL`, `NAN-BUS`), formats (2 m² scrolling, 2 m² Venusial, Scrolling MUI, 8 m² scrolling, 4 m² scrolling, 2 m² fixe, 4/8/12 m² collé, Bus arrière/latéral).
- Questions : écran d'édition absent (ajout d'un format/atelier « par paramétrage » : formulaires non maquettés) ; Nîmes Pliage 12M2 / DBG.

### ECR-ADM-02 — Machines et fichiers
- Source : `tab: 'machines'`.
- Tableaux : Machines (Machine, Type, Fichier Oui/Non, Tiroirs max (num), Format de sortie, Dépôt, Bagues) ; « Critères d'ordonnancement par atelier » (3 listes ordonnées : Trains, 2 m² fixe, Pliage).
- Données MOCK : 9 machines (`NIM-VEN`, `NIM-CCM`, `WIS-VEN`, `NIM-MR`, `WIS-MR`, `NIM-A8`, `WIS-A8`, `NIM-TR`, `WIS-TR`) ; sortie « INI (via GenfichierProd, outil Caire) » ou « CSV ; cp1252, sans en-tête, 1 fichier par annonceur et thème ».
- Filtres/actions : aucun. Principe : « sur le principe de regles.toml de l'outil Projet 1 : ajouter une machine revient à remplir une ligne ».
- Questions : édition inexistante dans la maquette ; répertoires de dépôt « à confirmer » (Wissous).

### ECR-ADM-03 — Statuts (catalogue et correspondance)
- Source : `tab: 'statuts'`.
- Structure : annotation ; 4 cartes d'origine avec compteur (Calculé, Existe dans Circé, Vient de Broadcast, À ajouter (V2)) ; filtres ; tableau « Statuts et tags · n au total » ; tableau « Codes de tr_statut : correspondance existant → cible » ; « Statuts cibles des dossiers, unités et colis » (pastilles).
- Tableaux : catalogue : Domaine, Statut ou tag (+ tags « à vérifier »/« sens à revoir »), Origine (C/E/B/N), Ce que ça veut dire, Où c'est dans Circé ou ce qu'il manque (avec noms de tables `en chasse fixe`), masquée Écran ; 109 lignes d'après README (11 domaines + une ligne par type d'alerte hors désactivée). Mapping : Code, Statut existant, Utilisé pour, Statut cible, Commentaire (12 lignes : 0 A traiter, 1 En cours, 2 Instruction Ok, 3 Erreur, 4 Annulé, 5 A imprimer, 9 Export prepa, 10 Au roulage, 6 Préparé, 7 A expédier, 8 Terminé, — Livré).
- Filtres : Domaine, Origine ; « + Filtre » Écran. Export xlsx.
- Actions : aucune (lecture, export).
- Données MOCK : tables/colonnes réelles citées : `tr_statut`, `tf_repart_calcul.rpc_statut`, `tf_face_train`, `instruction_train.rpc_statut`, `affiche.validationAdmin`, `tf_UM`, `tf_UM_colis`, `tf_colis` (`colis_dat_expe`, `date_depart`, `date_livraison`, `url_preuve_livraison`), `tf_train_export`, `livraison` (`DateLivraison`, `Decharge_par`), `asso_livraison_affiche`, `asso_livraison_photo`, `affiche` (`allee`, `rayon`, `rebus`, `a_conserver`, `conservation`, `zone_Picking`, `date_dernier_depart`, `cont_num`), `mouvement` (`comptee`), `tr_adresseMail_plateforme`, `th_edr_evenement`, `tf_prepa_Broadcast`, et colonnes futures `livraison.controle_statut/controle_par/controle_le`, `asso_affiche_visuel`. **Source précieuse pour le modèle de données cible** et les écarts existant/cible.
- Questions : libellés à valider en atelier ; statuts « N » à créer en base ; sens de `mouvement.comptee`.

### ECR-ADM-04 — Alertes et mails
- Source : `tab: 'alertes'`.
- Tableaux : « Règles d'alerte » (Alerte, Déclencheur, Seuil, Destinataires, Canal = liste modifiable : Bandeau, Bandeau + mail, Bandeau + mail immédiat, Bandeau + digest 7h, Désactivée) — 17 types : MANQUANT, ECART (+10 %), SANS_IP, ORPHELINE (important après 24 h), DOSSIER_INTROUVABLE, VALIDATION_ADMIN, FEUILLE_DEFINITIVE, CONTROLE_RETARD (24 h, important au double), IP_MANQUANTES (deadline jeudi S-2 16h), ECART_BC, THEME_BC, THEMES_PROCHES, ANNONCEURS_PROCHES, DM_FICHIER, APRES_LIBERATION, DEPART_RISQUE (72 h ; critique sous 36 h), THEME_MODIF, MAIL_COMMERCIAL (désactivée, tag « refusé le 14/10 ») ; « Listes de distribution » (Liste, Destinataires (rôles), Utilisée par) : 5 listes ; « Mails existants dans le code » (3 lignes : Réception affiche, Déblocages, « Un colis d'affiches vient de vous être expédié »).
- Actions : seul le canal est modifiable (`onChange` → journal « Canal d'alerte : … ») ; seuils/destinataires/gravités non modifiables ; aucune action sur les listes (pas d'ajout).
- Listes : Rajouts après préparation – Nîmes / – Wissous (chef d'atelier, admins de la plateforme, coordinateurs logistique), Thème modifié production lancée, Corrections de thème à Broadcast (gestionnaires pôle Direct/Intermédié), Intitulés corrigés par la plateforme (Pré-Prod du site).
- Questions : écran de gestion des listes (RP34) non maquetté (lecture) ; destinataires « Pré-Prod Nîmes » à confirmer (Q61) ; digest 7 h à confirmer.

### ECR-ADM-05 — Règles métier
- Source : `tab: 'regles'`.
- Formulaires (champs modifiables, effet immédiat en mémoire) :
  - Entretien : Grain de calcul (Afficheur (cible, REU-06) / Annonceur / thème / ville (existant)), Pas d'entretien en dessous de (affiches, défaut 3), Arrondi (supérieur / au plus proche).
  - Réception : Écart signalé au-delà de (%) (10), Purge automatique des réceptions attendues après (semaines, 4, sauf conservation à l'année), Délai de contrôle des palettes du sas (heures, 24), Comptage manuel par morceau si quantité < (30), Feuilles de stock : exemplaires imprimés au contrôle (2, min 1 max 5), Allée des réceptions inconnues (texte, majuscules, défaut `X`).
  - Fichiers multi-rouleuse : regroupements d'enseignes (liste motif = valeur, bouton « + Ajouter un regroupement » : `*NOUVELLE ENSEIGNE*`), Seuil de similarité des thèmes proches (0,85).
  - Fin de campagne : délais de destruction (2 m² MUI compris : 4 ; 8 m² : 2 ; autres formats : 4 semaines), Points d'attention (texte `BDX, MUI`), mentions fixes (Conservation MUI, garde-fou, coche).
  - Trains (lecture) : Positions max par train (liste 4 (deck S7) / 6 (code), non liée), Tiroirs Vendôme (20), Instruction OK automatique (texte de la règle du 26/10), Campagne contrôlée (15 % et visuel en début de train).
- Messages : toasts « Seuil enregistré (s'applique aux prochaines préparations). » ; « n réception(s) attendue(s) purgée(s). » ; validations à la saisie : valeurs minimales appliquées par `Math.max`.
- Données MOCK : valeurs par défaut listées ci-dessus.
- Questions : plusieurs valeurs « à fixer en atelier » (comptage par morceau, nb exemplaires, délai de contrôle) ; entretien « quid des quantités < 10 ? » (PP-04/05) ; persistance et audit des changements de paramètres (seul le journal des actions existe) ; règles « Trains » non modifiables en maquette.

### ECR-ADM-06 — Transport
- Source : `tab: 'transport'`.
- Tableaux : « Boucles et horaires de départ » (Plateforme, Boucle, Canal, Départ (ex. « jeu. S-1 16h30 »), Destinations). Hors Nanterre.
- Actions : aucune (lecture). Annotation : un seul transporteur Geodis (milk run et messagerie, réponse du 13/10) ; le code colis Circé sert de référence d'envoi.
- Données MOCK : 19 destinataires (3 Nanterre bus en « Remise directe ») ; `jour` = décalage depuis le lundi de S-1 (3 = jeudi S-1 … 7 = lundi S).
- Questions : édition des boucles ; calendrier exceptionnel (jours fériés).

### ECR-ADM-07 — Référentiels
- Source : `tab: 'referentiels'`.
- Structure : 3 cartes de listes (Imprimeurs, Livreurs (transporteurs à la réception), Agents de réception (contrôleurs)) avec boutons « + Ajouter un imprimeur / un livreur / un agent » ; tableau « Destinataires et afficheurs » (Site, Destinataire, Boucle, Afficheurs) avec recherche ; carte « Rouleurs » (tags « Rouleur N1 · Nîmes · Table 1 »).
- Actions : « + Ajouter » crée une valeur factice (`Nouvel imprimeur n`) + journal ; pas de suppression ni de renommage.
- Données MOCK : 6 imprimeurs (dont `Print Cityz`), 4 livreurs (Geodis, Transports Martin, Messagerie Express, Livraison imprimeur), 4 contrôleurs (`Contrôleur A…D`), 11 rouleurs (6 Nîmes, 5 Wissous), afficheurs « Équipe <nom> » (2-3 par destinataire, 1 par dépôt bus).
- Questions : saisie réelle d'un nouvel élément (libellé libre, désactivation) ; gestion des utilisateurs/droits « phase 4 » absente.

### ECR-ADM-08 — Journal
- Source : `tab: 'journal'`.
- Tableaux : Date (tri desc.), Par, Objet, Action (texte long). Export xlsx.
- Données MOCK : générations, libérations, événements, actions utilisateur (`M.journal(objet, action, user)`), ex. « Purge automatique ».
- Questions : durée de rétention, filtres par objet absents (recherche seulement), distinction journal d'audit / historique d'un objet (le dossier a son propre `historique`).

---

## 9. Aide à la lecture (propres à la maquette, **hors cible**)

### ECR-AID-01 — Parcours guidés
- Source : `screens/parcours.js`. Accès : Aide › Parcours guidés.
- Structure : grille 3 colonnes de 9 cartes numérotées (titre, rôle, étapes cliquables, pastilles de besoins) : 1 Pilotage du matin (cheq) ; 2 Une livraison sans référence, de la palette au train (recep) ; 3 Une réception qui débloque des trains (recep) ; 4 Coordination : préparations reçues, Instruction OK et validation admin (coord, 10 étapes) ; 5 2 m² fixe : du dossier aux fichiers multi-rouleuse en un clic (cheq) ; 6 Vendôme : le chef d'équipe choisit les trains du fichier (cheq) ; 7 Un rajout arrive après la préparation (cheq) ; 8 Dernière minute sur un train déjà en production (cheq) ; 9 Expédier et mettre à jour le stock (expe).
- Actions : clic sur une étape → change de rôle si besoin, ouvre l'écran avec paramètres ou déclenche une simulation (`M.SIMULATIONS`).
- Utilité pour l'équipe : les 9 parcours listent les scénarios de recette (E2E) à reprendre : parcours 2 et 3 (Réception), 4 (Coordination), 9 (Expédition-Stock). Voir §A.

### ECR-AID-02 — Traçabilité des besoins
- Source : `screens/besoins.js` (écran), `assets/js/besoins.js` (catalogue ~164 besoins, 253 lignes).
- Structure : filtres (Catégorie, Couverture, Écran) ; 5 indicateurs (Besoins du référentiel ; Montrés ; Montrés en partie ; Hors maquette ; Non couverts) ; tableau.
- Tableaux : ID (puce `ANO-01`…), Catégorie, Besoin, Source (ex. `S61 #1`, `RP32 #4`), Écrans ou raison (liens), Couverture (pastille), masquée Raison ou reste à faire. Export csv. Liseré critical si non couvert.
- Catégories d'ID : ANO (anomalies 15), ERG (ergonomie 10), REC (réception 27), PP (pré-prod), SCR, FIX, BUS, CIB, PROC, REU, SP, QUA, AUT, ADM, EXP, BC, FP… (extrait lu : ANO-01..15, ERG-01..10, REC-01..27, PP-01..04+).
- Couverture (README) : 164 besoins, 112 montrés, 24 en partie, 21 hors maquette, 7 non couverts (FIX-10, FIX-12, FIX-13, BUS-04, QUA-03, AUT-04, ADM-04).
- **Intérêt direct** : le catalogue `needs: [...]` de chaque écran donne le mapping écran ↔ exigence : à rapprocher des `EX-<MOD>-nnn`.

---

## A. Événements « Simuler » (app.js) — scénarios de comportement cible

10 événements (aussi utiles comme cas de test) : 1) Dossier 2 m² fixe arrive après la libération (alerte + mail chefs d'équipe/Coordination, REU-04) ; 2) Visuel arrive après préparation des trains (mail à la liste « Rajouts après préparation », RP34) ; 3) Dernière minute sur train en production (alerte critique `DM_FICHIER`, mail) ; 4) Livraison sans référence (réception inconnue : rangée allée `X`, feuille temporaire, alerte) ; 5) Réception qui complète un manquant (affiche reçue = oui, palette à contrôler, rattachement proposé, unités → PRET) ; 6) Fin de journée Geodis ; 7) Preuves de livraison ; 8) Broadcast change un thème après validation ; 9) Broadcast renvoie les préparations corrigées ; 10) Réinitialiser.

Règle `renvoiPrepa(d)` (préparation renvoyée par Broadcast) : si les trains ne sont pas exportés, l'Instruction OK est refaite (`delete d.iok`) ; la validation admin ne bouge pas ; après export du jeudi 14 h, les trains restent figés (« A imprimer ») et une alerte `APRES_LIBERATION` part à Coordination + chefs d'équipe.

---

## B. Graphe de navigation entre écrans

```
[Logo] ───────────────► PIL-01 Dashboard  (écran d'ouverture)
Bandeau 1 : cloche ───► Alertes (hors périmètre) ;  enveloppe ► boîte Mails (modale simulée)
            Aide ─────► AID-01 Parcours guidés ; AID-02 Traçabilité des besoins

PIL-01 ── « Reste à recevoir » / « En attente » ──► PIL-03 (?ou=AFFICHES,PARTIEL)
PIL-01 ── « Toutes les alertes » / « Ouvrir » ────► Alertes / écran de l'alerte
PIL-01 / PIL-02 / PIL-03 ── clic ligne ──► PIL-04 Fiche dossier (tiroir)
PIL-04 ── « Voir dans Instructions » ──► Instructions (?q=) [Coordination]
PIL-04 ── « Voir les affiches » ───────► Liste des affiches (?tab=affiches&q=) [Réception]
THM-01 / THM-02 ── « Ouvrir le dossier » ──► Instructions (?statut=TOUS&q=)
THM-03 ── « Voir le dossier » ─────────► PIL-03 (?dossier=)
THM-01/02/03 ◄─► (sous-entrées de menu) Pré-production › Vérification des thèmes
STK-01 ◄─► STK-02 (sous-entrées « Stock par affiche » / « Mouvements »)
STK-01 « Mettre au rebut » ► mouvement ► STK-02 ; EXP-02 « Fin de journée » ► mouvements ► STK-02 ; STK-03 ► mouvements (Renvoi/Destruction)
EXP-01 ─ scan ─► colis ouvert ─ « Clore » ─► EXP-02 ─ « Fin de journée Geodis » ─► Expédié ─ (Simuler : preuves) ─► Livré
EXP-03 (lecture) ◄─ mêmes filtres ; sous-entrées Scan et colisage / Colis / Départs camions
GEN-01 / GEN-02 ── « Préparer / Proposer » ──► GEN-03 ── « Envoyer à la machine » ──► unités EN_PROD (PIL, EXP)
Déroulant › Liste des trains / Préparation ── « Générer les fichiers » (trains cochés) ──► GEN-01 (pré-sélection)
GEN-03 « Générer un complément » (alerte DM) ◄── Alertes DM_FICHIER
ADM-01..08 : sous-entrées de Administration › Paramétrage ; paramètres lus par Réception (REC), Stock/Fin de campagne (ADM-05), Générateur (ADM-02, ADM-05), THM (seuil 0,85)
« ← Retour : <page> » après tout lien M.go (pile de 20)
```

---

## C. Entités et champs déduits des MOCK (modèle de données implicite de la maquette)

Identifiants observés (formats fictifs, à ne pas figer) : dossier `910037` (6 chiffres ; 2e plateforme `…-W` avec `no` = dossier mère), DA `470053`, thème `TH12`, ligne de préparation `L5`, train `TR-0001`, UM `UM-0001`, lot pliage `PL-`, lot bus `BU-`, affiche `712001` (6 chiffres), réception `R260401` (R + 26 + 0401), BL `BL` + 7 chiffres, colis `C-0000000000063` + 4101…, génération `G-0412`, récépissé Geodis `905…`/`906…` (8 chiffres), mouvement `MV-1001`, alerte clé `MQ-<theme>`, `EC-`, `IP-<affiche>`, `DI-`, `OR-`, `VA-`, `PP-<dossier>`, `BC-<dossier>`, `EV-…`, réception attendue ancienne `RA-36-0`, afficheur `AF-BOR1`, opérateur `NIM-OP1`.

Entités : **Site** (id NIM/WIS/NAN, label, cible) ; **Semaine** (num 42-45, statut expédiée/en production/en préparation/à venir) ; **Atelier** (id, site, label, mode train|unitaire, type fixe|pliage|bus, formats[], machines[], cible) ; **Machine** (id, site, type vendome|ccm|multirouleuse|assemblage|roulage, fichier, tiroirs, bagues, sortie, répertoire) ; **Destinataire** (id, site, label, boucle, canal MILK|MESSAGERIE|DIRECT, jour, hh, mm) ; **Afficheur** (id, dest, label) ; **Opérateur/rouleur** (id, site, label, poste) ; **Dossier** (id, da, no, annonceur, site, semaine, semaines[], atelier, format, entretienPct 8-15, print, controlee, ipSaisies, prepaEnvoyee, prepaDate, statutPP A_TRAITER|PREPA_RECUE|VALIDE|ANNULE, qteBC, qteBCInfo {bc,circe,date}, pole Direct|Intermédié, apresLiberation, commentPrepa, iok, exporte, typeReal, daLignes[{typeReal,site,faces,affiches}], historique[]) ; **Thème** (id, dossierId, libelle, libelleBC, modifBC, position A-D, exclu NE_PAS_AFFICHER|RESTE_EN_PLACE, qte, qteEnt, d8 {haut,bas,final}, repiquage, livraisonPrevue, annonceurImprime, libelleVisuel) ; **Ligne de préparation** (id, themeId, dossierId, site, semaine, atelier, dest, afficheur, qte, entretien) ; **Unité** (id, kind TRAIN|UM|LOT, site, semaine, atelier, machine, dest, afficheur, nb, positions[{themeId,fr,couvert}] | ligneId+themeId, statut EN_ATTENTE|PRET|EN_PROD|PRODUIT|COLISE|EXPEDIE|LIVRE, bague, operateur, generation, modifs[], colis) ; **Réception** (id, site, date, bl, transporteur, imprimeur, nbColis, dechargePar, controleur, affiches[], lignes[{afficheId,qte}], statut A_CONTROLER|A_IDENTIFIER, photoBL, ordre, orpheline) ; **Affiche** (id, receptionId, receptions[], site, date, statut IDENTIFIEE|ORPHELINE, qteBL, qteRecue, alloc[{themeId,qte}], rattache BL|VISUEL|MAIN, annonceurSaisi, libelleSaisi, format, imprimeur, allee, rayon, rebut, aConserver, semaines[], controleur, enAttenteControle, feuilleImprimee TEMPORAIRE|DEFINITIVE, themeModif {ancien,nouveau,date,par,origine,reimprime}, va {etat MANUELLE|ANNULEE, user, date, motifs[]}, signalePP, verite, historique[]) ; **Mouvement de stock** (id, date, afficheId, type, qte signée, user, auto, motif) ; **Colis** (id, site, semaine, dest, canal, unites[], statut COLIS_OUVERT|COLIS_CLOS|EXPEDIE|LIVRE, clos, recepisse, expedie, livre) ; **Génération de fichiers** (id, machine, site, semaine, date, user, unites[], nbFichiers, statut, version, note) ; **Libération de semaine** (site, semaine, atelier, date, user) ; **Événement/alerte** (key, type, sev critical|serious|warning|info, site, semaine, date, titre, message, link{screen,params}, roles[], needs[]) ; **Acquittement d'alerte** (set de keys) ; **Mail simulé** (date, to[], subject, body, trigger, needs, lu) ; **Journal** (date, user, objet, action) ; **Vérification de thèmes** (clé = ids de thèmes triés ; statut DIFFERENTS|CORRIGE, user, date) ; **Demande de correction de thème** (par thème : statut ENVOYEE|FAITE, ref, ancien, date, user, note, fait) ; **Vérification d'annonceurs** (clé = dossiers ; DIFFERENTS|CORRIGE) ; **Demande de correction d'annonceur** (par dossier) ; **Décision de fin de campagne** (par dossier : decision A_DECIDER|CONSERVER|ENVOYER|DETRUIRE|ENVOYE|DETRUIT, date, user, jusqua, motif, destinataire, qte, envoye, qteEnvoyee, detruit, qteDetruite) ; **Réception attendue ancienne** (id, site, semaine, dossier, annonceur, theme, statut Partiel|Attendue, reste, conservation) ; **Paramètres métier** (voir ADM-05) ; **Règle d'alerte** (type, déclencheur, seuil, destinataires, canal) ; **Liste de distribution** (liste, destinataires (rôles), usage) ; **Besoin** (id, catégorie, libellé, source).

Valeurs de statut observées (à confirmer, jamais à recopier sans validation) :
- Dossier : `A_TRAITER`, `PREPA_RECUE`, `VALIDE` (interne, non affiché), `ANNULE`.
- Unité : `EN_ATTENTE`, `PRET`, `EN_PROD`, `PRODUIT`, `COLISE`, `EXPEDIE`, `LIVRE`.
- Colis : `COLIS_OUVERT`, `COLIS_CLOS`, `EXPEDIE`, `LIVRE`.
- Affiche : `IDENTIFIEE`, `ORPHELINE` ; validation admin : `PROPOSEE`, `A_FAIRE`, `MANUELLE`, `ORPHELINE`, `ANNULEE` ; dossier : `A_FAIRE`, `FAITE`, `AUCUNE`, `SANS_OBJET`.
- Réception : `A_CONTROLER`, `A_IDENTIFIER` (+ contrôlée).
- Instruction OK : `SANS_OBJET`, `ATTENTE`, `MANUEL`, `AUTO`, `A_FAIRE`.
- Où en est-il : `DA`, `IP`, `AFFICHES`, `PARTIEL`, `PREPA`, `PROD`, `PRODUIT`, `EXPEDIE`, `LIVRE`, `ANNULE`.
- Fin de campagne : voir STK-03. Thèmes proches : `A_VERIFIER`, `DEMANDE`, `CORRIGE`, `DIFFERENTS`, `MEME`.
- Gravités : `critical`, `serious`, `warning`, `info`, `good`.
- Types d'alerte (17) : voir ADM-04.
- Cas limites illustrés : dossier annulé, dossier sur 2 semaines (quantité comptée une fois), dossier livré sur 2 plateformes, visuel commun à plusieurs dossiers (MISTRAL), réception sans IP (intitulé saisi par la plateforme, ex. « BURGER »), surplus > 10 %, affiche multi-semaines, réception inconnue (illisible sur le BL, `bl: '—'`), train fractionné (`fr`), dossier arrivé après libération, dernière minute, écart BC/Circé, campagne contrôlée (15 % d'entretien).
- Volumétrie MOCK : 3 sites, 10 ateliers, 9 machines, 19 destinataires, 4 semaines (S42-S45), ~24 annonceurs, 25 thèmes de base ; ~60-100 dossiers ; 4 réceptions inconnues ; 9 réceptions attendues anciennes ; 3 générations.

## D. Zones non analysées / limites

- `ui.js` (composants : table, filtres, modales, `dossierDrawer`, `mailbox`, `simulateMenu`) non lu ; comportement déduit des appels.
- `data.js` : lignes 1044-1100 (fin des alertes, algorithme `lcs`/`simplifier`) non lues ; reste lu.
- `assets/js/besoins.js` : catalogue lu sur 70 lignes sur 253 (mappings `hors` et `partiel` non exploités).
- `app.css`, `notes/releve-existant-code.md`, `notes/veille_github_composants.md`, `assets/vendor/*` non lus.
- `apercu-navigation-haut.html` lu par extractions (texte, tableaux) : le rendu visuel et le CSS inline n'ont pas été examinés.
- Écrans exclus (autre agent) : reception, identification, dispatch, instructions, trains, unitaire, bagues, alertes ; seules leurs dépendances sont décrites au §0.
