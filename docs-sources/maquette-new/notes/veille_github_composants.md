# Veille GitHub : design et composants pour la refonte de Circé

| | |
|---|---|
| **Date** | 14/10/2026. Recentrée sur le design le même jour. |
| **Méthode** | Recherche sur GitHub par thèmes et mots-clés génériques (dashboard, data grid, gantt, barcode, bin packing, OCR…), complétée par une liste de candidats connus. Pour chaque dépôt, les étoiles, la licence et la dernière activité ont été relevées le jour même par l'API publique de GitHub. Aucune donnée Cityz n'a été envoyée. |
| **Lecture** | ✅ = recommandé pour Circé. ⬇ = téléchargé pour la maquette. « Licence non standard » = GitHub ne reconnaît pas de licence standard (licence maison, double licence ou édition payante) : à vérifier avant tout usage. Les remarques sur les licences marquées « *à confirmer* » viennent de ma connaissance et non de l'API. |
| **Recentrage** | La veille sert d'abord au **design**, parce que l'interface actuelle de Circé est fouillis. OR-Tools, Apprise et l'OCR sont **mis de côté pour l'instant**, avec les dépôts qui servent au même usage (dernière section). La reconnaissance visuelle des orphelines reste listée (§13). |
| **Téléchargements** | Validés le 14/10/2026 **pour les maquettes uniquement** : Tabler, Tabler Icons, ECharts et Tabulator, copiés dans `maquette/assets/vendor/`. Versions, licences et contrôle d'empreinte : `maquette/assets/vendor/VERSIONS.md`. Rien d'autre n'a été téléchargé ni installé. |

## Synthèse : les meilleurs choix par aspect

**Design (priorité)**

| Aspect | Écran de la maquette concerné | Choix recommandé | Alternative |
|---|---|---|---|
| Système de design et icônes | Toute la maquette | ⬇ **Tabler** et ⬇ **Tabler Icons** (MIT) ; **Carbon** d'IBM comme référence de règles pour les applications d'entreprise denses | shadcn/ui pour SFER (React) |
| Tableaux de données | Tous les écrans de liste | ⬇ **Tabulator** (MIT, JavaScript simple) | TanStack Table (MIT) si SFER part en React |
| Graphiques | Suivi de prod | ⬇ **ECharts** (Apache-2.0) | Chart.js (MIT), uPlot (séries temporelles) |
| Charte de design lisible par l'IA | Toute la maquette | **awesome-design-md** (format `DESIGN.md`, appliqué dans `maquette/DESIGN.md`) et **anthropics/skills** (skill `frontend-design`) | taste-skill |
| Mise en forme des mails | Alertes, mails simulés | **MJML** (MIT) | react-email si SFER part en React |
| Maquettage partagé | Ateliers | **Penpot** (MPL) | Excalidraw (MIT) |
| Contrôle du design | — | **axe-core** (accessibilité, contrastes) et **Playwright** (parcours) | — |

**Autres aspects**

| Aspect | Écran de la maquette concerné | Choix recommandé | Alternative |
|---|---|---|---|
| Suivi de prod, dashboards | Suivi de prod, Accueil | Intégré à l'application avec **ECharts** et **Tabulator**, comme dans la maquette ; POC rapide avec **Streamlit** (déjà sur ton poste) | Superset si un outil BI séparé est voulu |
| Planning, départs camions | Expédition › Départs, Dispatch | **Frappe Gantt** (MIT) | FullCalendar (MIT, vues de base) |
| Statuts paramétrables | Paramétrage › Statuts | **XState** (MIT) | — |
| Scan, codes-barres, étiquettes | Expédition, Réception, Bagues | **html5-qrcode** ou **zxing-js** pour scanner, **JsBarcode** pour générer, **BinaryKits.Zpl** pour les étiquettes Zebra (.NET, comme le Circé actuel) | bwip-js, jsPDF |
| Fichiers de prod (CSV, Excel) | Générateur de fichiers | **pandas** et **pandera** en Python (POC), **PapaParse** et **ExcelJS** côté navigateur | polars |
| Orphelines (reconnaissance visuelle) | Identification | **imagehash** puis **open_clip** et **faiss**, en local | idealo/imagededup |
| Références métier (stock, MES) | Stock, Suivi de prod | **InvenTree** (MIT) pour les emplacements et le stock ; **OEE-Designer** pour les indicateurs de production | Odoo, ERPNext |

---

## 1. Du fouillis à la cible : règles de design et références

Les sept défauts ci-dessous sont ceux relevés dans l'interface actuelle (`maquette/DESIGN.md`, §0). Pour chacun : la règle retenue, la référence qui l'inspire et l'endroit où la maquette l'applique.

| Défaut de l'interface actuelle | Règle cible (DESIGN.md) | Référence qui l'inspire | Appliqué dans la maquette |
|---|---|---|---|
| Sept menus organisés par atelier | Un onglet par processus, en haut : pilotage, tronc commun amont, production trains, production unitaire, tronc commun aval, administration | Tabler (mise en page horizontale : bandeau et menus déroulants) | Deux bandeaux en haut (périmètre, puis onglets) ; chaque onglet liste ses pages et leurs onglets internes, avec les compteurs d'exceptions |
| Grilles de 15 à 25 colonnes tronquées, un filtre sous chaque colonne | 8 colonnes visibles au plus, une seule recherche, les autres colonnes à la demande | Tabulator ; Carbon (tableaux de données) | Tous les tableaux : bouton « Colonnes 8/26 », retour à la « Vue par défaut », vue mémorisée |
| Boutons gris tous identiques | Une seule action principale par écran | Tabler (bouton principal, boutons secondaires discrets) | En-tête de chaque écran |
| Cinq icônes par ligne | Deux actions libellées au plus par ligne ; les actions de masse passent par la sélection | Carbon (actions de ligne, barre d'actions groupées) | « 3 sélectionnées : … » au-dessus des tableaux, actions de ligne figées à droite |
| Statuts écrits en texte brut | Pastille de couleur avec libellé ; gravité = icône + libellé, jamais la couleur seule | Carbon (indicateurs de statut) | Pastilles de statut, badges de gravité, liseré coloré des lignes en exception |
| Fenêtres modales empilées | Panneau latéral pour consulter, fenêtre modale pour agir | Tabler (panneau latéral, fenêtre modale) | Fiche dossier en panneau, fiche affiche en fenêtre |
| Police à empattements de 11 à 12 px | Police système, 14 px ; 13 px dans les tableaux ; chiffres alignés | Tabler (typographie) | Toute la maquette |

**Ce que la cible ajoute**

| Règle | Référence | Appliqué dans la maquette |
|---|---|---|
| 5 indicateurs au plus par écran, cliquables pour filtrer | Tabler (cartes d'indicateurs) | Accueil, Suivi de prod, Réception, Alertes (4 gravités + filtres par type) |
| Graphiques en barres horizontales, rampe bleue ordonnée (clair = en amont, foncé = terminé), total en bout de barre, vue tableau équivalente | ECharts | Suivi de prod : avancement par atelier, par départ camion, reste à recevoir par annonceur |
| Une charte écrite, lisible par les équipes comme par les agents IA | awesome-design-md, anthropics/skills | `maquette/DESIGN.md` (palette, typographie, composants, règles à faire et à éviter) |
| Contraste AA (4,5 pour 1) pour le texte et les actions | axe-core (contrôle automatique, à brancher) | Palette calculée : bleu d'action à 5,66 pour 1 sur fond blanc |

## 2. Design, kits d'interface et aides au design pour l'IA

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ ⬇ [tabler/tabler](https://github.com/tabler/tabler) | 42 k | MIT | 10/2026 | Kit de tableau de bord en HTML et CSS, mode sombre, plus de 100 pages : compatible avec la maquette hors ligne. **Utilisé** (1.6.1) : base de tous les composants de la maquette. |
| ✅ ⬇ [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 22 k | MIT | 10/2026 | Plus de 5 000 icônes SVG. **Utilisé** (3.49.0) : 80 icônes embarquées, sans police d'icônes. |
| ✅ [carbon-design-system/carbon](https://github.com/carbon-design-system/carbon) | 10 k | Apache-2.0 | 10/2026 | Système de design d'IBM, conçu pour les applications d'entreprise denses : référence de règles (tableaux, statuts, notifications). Lu, pas téléchargé. |
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 126 k | MIT | 10/2026 | Standard actuel en React et Tailwind : piste pour SFER. |
| [ColorlibHQ/AdminLTE](https://github.com/ColorlibHQ/AdminLTE) | 46 k | MIT | 10/2026 | Kit d'administration Bootstrap, plus classique que Tabler. |
| [saadeghi/daisyui](https://github.com/saadeghi/daisyui) | 43 k | MIT | 10/2026 | Composants Tailwind avec thèmes. |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | 25 k | non standard | 10/2026 | Icônes fines et cohérentes ; *à confirmer* : ISC. |
| [alexpate/awesome-design-systems](https://github.com/alexpate/awesome-design-systems) | 26 k | Unlicense | 10/2026 | Inventaire des systèmes de design publics. |
| ✅ [anthropics/skills](https://github.com/anthropics/skills) | 181 k | non détectée | 10/2026 | Skills officiels d'Anthropic : `frontend-design` (interfaces soignées), `theme-factory`, `webapp-testing`, `brand-guidelines`. Licence à vérifier skill par skill. |
| ✅ [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) | 121 k | MIT | 10/2026 | Fichiers `DESIGN.md` lus par les agents IA. **Format repris** pour `maquette/DESIGN.md`. |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 96 k | MIT | 10/2026 | Skills de « goût » pour agents, surtout pour des pages publiques ; demande Node 22. |

## 3. Tableaux de données (grilles)

Besoins concernés : colonnes à choisir et réordonner, sélection multiple, filtres, export, lignes colorées (ERG-02, ERG-03, ERG-04, FIX-03).

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ ⬇ [tabulator-tables/tabulator](https://github.com/tabulator-tables/tabulator) | 8 k | MIT | 10/2026 | JavaScript simple, sans framework : déplacement de colonnes, sélection multiple, regroupements, export CSV et Excel. **Utilisé** (6.6.1) pour tous les tableaux de la maquette. |
| ✅ [TanStack/table](https://github.com/TanStack/table) | 28 k | MIT | 10/2026 | Moteur de tableau sans interface imposée : le standard si SFER développe en React, Vue ou Angular. |
| [ag-grid/ag-grid](https://github.com/ag-grid/ag-grid) | 16 k | non standard | 10/2026 | La grille d'entreprise de référence. *À confirmer* : édition Community en MIT, fonctions avancées (regroupement, export Excel) payantes. |
| [revolist/revogrid](https://github.com/revolist/revogrid) | 3 k | MIT | 10/2026 | Très rapide sur de gros volumes, style tableur. |
| [glideapps/glide-data-grid](https://github.com/glideapps/glide-data-grid) | 5 k | MIT | 01/2026 | Rendu sur canevas, très fluide (React). |
| [grid-js/gridjs](https://github.com/grid-js/gridjs) | 5 k | MIT | 01/2026 | Très simple, pour des listes en lecture. |
| [jspreadsheet/ce](https://github.com/jspreadsheet/ce) | 7 k | MIT | 09/2026 | Saisie façon Excel (quantités, comptages). |
| [SortableJS/Sortable](https://github.com/SortableJS/Sortable) | 31 k | MIT | 03/2026 | Glisser-déposer pour réordonner lignes, positions dans un train ou panier de réception (REC-01). |
| [handsontable/handsontable](https://github.com/handsontable/handsontable) | 22 k | non standard | 10/2026 | ⚠ Licence payante pour un usage commercial : à éviter. |

## 4. Graphiques

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ ⬇ [apache/echarts](https://github.com/apache/echarts) | 68 k | Apache-2.0 | 10/2026 | Le plus complet : barres empilées, jauges, calendriers, cartes ; fonctionne hors ligne sans dépendance. **Utilisé** (6.1.0, rendu SVG) pour les graphiques du suivi de prod. |
| ✅ [chartjs/Chart.js](https://github.com/chartjs/Chart.js) | 68 k | MIT | 10/2026 | Simple et léger, pour des graphiques classiques. |
| [leeoniya/uPlot](https://github.com/leeoniya/uPlot) | 11 k | MIT | 10/2026 | Très rapide pour les séries temporelles (charge par heure). |
| [frappe/charts](https://github.com/frappe/charts) | 15 k | MIT | 10/2026 | Graphiques simples et élégants, sans dépendance. |
| [observablehq/plot](https://github.com/observablehq/plot) | 5 k | ISC | 09/2026 | Graphiques d'analyse rapides à écrire. |
| [d3/d3](https://github.com/d3/d3) | 114 k | ISC | 05/2026 | Sur mesure total, mais coûteux à développer. |
| [plotly/plotly.js](https://github.com/plotly/plotly.js) | 18 k | MIT | 10/2026 | Interactif, également utilisable depuis Python. |
| [apexcharts/apexcharts.js](https://github.com/apexcharts/apexcharts.js) | 15 k | non standard | 10/2026 | Joli, mais licence à vérifier (*à confirmer* : passage à une licence payante pour les grandes entreprises). |

## 5. Maquettage et ateliers

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [penpot/penpot](https://github.com/penpot/penpot) | 61 k | MPL-2.0 | 10/2026 | Alternative libre à Figma, auto-hébergeable : écrans annotés partagés avec SFER. |
| ✅ [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 134 k | MIT | 10/2026 | Croquis rapides pendant les ateliers (parcours, flux). |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) | 51 k | non standard | 10/2026 | Tableau blanc ; licence spécifique. |
| [evolus/pencil](https://github.com/evolus/pencil) | 10 k | GPL-2.0 | 10/2026 | Maquettes fil de fer sur poste. |
| [onlook-dev/onlook](https://github.com/onlook-dev/onlook) | 27 k | Apache-2.0 | 08/2026 | Retouche visuelle de code d'interface assistée par IA. |

## 6. Qualité du design et documentation

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [microsoft/playwright](https://github.com/microsoft/playwright) | 98 k | Apache-2.0 | 10/2026 | Tests automatiques des parcours de la maquette, puis recette de l'application SFER. |
| ✅ [dequelabs/axe-core](https://github.com/dequelabs/axe-core) | 8 k | MPL-2.0 | 10/2026 | Contrôle automatique d'accessibilité (contrastes, lecteurs d'écran). |
| [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid) | 91 k | MIT | 10/2026 | Diagrammes en texte (déjà utilisés dans les livrables des phases). |

## 7. Suivi de prod et dashboards

| Dépôt | ★ | Licence | Activité | Intérêt pour Circé |
|---|---|---|---|---|
| ✅ [streamlit/streamlit](https://github.com/streamlit/streamlit) | 46 k | Apache-2.0 | 10/2026 | Dashboards en Python, en quelques heures, à partir des exports (état des réservations, liste des affiches). Déjà installé sur ton poste : idéal pour un POC de suivi de prod. Désactiver la télémétrie (`gatherUsageStats = false`). |
| ✅ [apache/superset](https://github.com/apache/superset) | 75 k | Apache-2.0 | 10/2026 | Outil BI complet (tableaux de bord, filtres, droits). À retenir si on veut un outil BI à côté de Circé plutôt que dans Circé. |
| [evidence-dev/evidence](https://github.com/evidence-dev/evidence) | 7 k | MIT | 10/2026 | Rapports et dashboards écrits en SQL et Markdown, versionnables : bon format pour un suivi hebdomadaire figé. |
| [plotly/dash](https://github.com/plotly/dash) | 24 k | MIT | 10/2026 | Alternative à Streamlit, plus structurée pour une application durable. |
| [gristlabs/grist-core](https://github.com/gristlabs/grist-core) | 12 k | Apache-2.0 | 10/2026 | Tableur-base de données avec vues et formulaires : peut remplacer les Excel de suivi pendant la transition. |
| [getredash/redash](https://github.com/getredash/redash) | 29 k | BSD-2-Clause | 10/2026 | Requêtes SQL et tableaux de bord simples. |
| [metabase/metabase](https://github.com/metabase/metabase) | 50 k | non standard | 10/2026 | Très simple pour les métiers. *À confirmer* : AGPL pour l'édition libre, plus une édition payante. |
| [grafana/grafana](https://github.com/grafana/grafana) | 77 k | AGPL-3.0 | 10/2026 | Excellent pour du temps réel, mais orienté supervision technique ; licence AGPL. |
| [lightdash/lightdash](https://github.com/lightdash/lightdash) | 6 k | non standard | 10/2026 | BI branché sur dbt. |
| [tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm) | 16 k | Apache-2.0 | 01/2025 | Composants React de dashboard très soignés ; dépôt peu actif depuis janvier 2025. |
| [perspective-dev/perspective](https://github.com/perspective-dev/perspective) | 11 k | Apache-2.0 | 10/2026 | Tableaux croisés interactifs très rapides (remplace un TCD Excel). |

**Indicateurs de production industrielle (OEE, avancement)**

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| [point85/OEE-Designer](https://github.com/point85/OEE-Designer) | 118 | MIT | 09/2026 | Modèle d'indicateurs de production (disponibilité, performance, qualité) : source d'inspiration pour les KPI par machine. |
| [united-manufacturing-hub/united-manufacturing-hub](https://github.com/united-manufacturing-hub/united-manufacturing-hub) | 397 | Apache-2.0 | 10/2026 | Plateforme de suivi d'atelier, avec tableaux de bord OEE : référence d'architecture. |
| [Actyx/industrial-ui](https://github.com/Actyx/industrial-ui) | 91 | non standard | 01/2023 | Composants d'interface pour écrans d'atelier (gros boutons, lisibilité) : idée pour les écrans de poste. Peu actif. |

## 8. Planning, Gantt, calendrier

Besoins concernés : départs camions, charge par machine et par rouleur, planification (CIB-11), rétroplanning.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [frappe/gantt](https://github.com/frappe/gantt) | 6 k | MIT | 06/2026 | Gantt léger et lisible : charge par machine, fenêtres de production. |
| ✅ [fullcalendar/fullcalendar](https://github.com/fullcalendar/fullcalendar) | 21 k | MIT | 10/2026 | Calendrier des départs et des deadlines. *À confirmer* : la vue « timeline par ressource » est payante. |
| [visjs/vis-timeline](https://github.com/visjs/vis-timeline) | 3 k | non standard | 10/2026 | Frise chronologique par ressource (machines, quais) ; *à confirmer* : double licence Apache-2.0 / MIT. |
| [DHTMLX/gantt](https://github.com/DHTMLX/gantt) | 2 k | MIT | 09/2026 | Gantt riche ; vérifier quelles fonctions sont réservées à l'édition payante. |
| [svar-widgets/react-gantt](https://github.com/svar-widgets/react-gantt) | 212 | MIT | 10/2026 | Gantt React récent. |
| [nhn/tui.calendar](https://github.com/nhn/tui.calendar) | 13 k | MIT | 06/2024 | ⚠ Archivé : à éviter. |

## 9. Statuts, workflow, kanban

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [statelyai/xstate](https://github.com/statelyai/xstate) | 30 k | MIT | 10/2026 | Machines à états décrites en configuration, avec visualiseur : parfait pour des statuts paramétrables et leurs transitions (phase 2 et cible). |
| [kanboard/kanboard](https://github.com/kanboard/kanboard) | 10 k | MIT | 10/2026 | Kanban simple : idée de vue « par statut » pour les trains et les UM. |
| [plankanban/planka](https://github.com/plankanban/planka) | 13 k | non standard | 10/2026 | Kanban moderne ; licence à vérifier. |
| [riktar/jkanban](https://github.com/riktar/jkanban) | 1 k | Apache-2.0 | 10/2023 | Composant kanban en JavaScript simple ; peu actif. |

## 10. Mails et notifications à l'écran : mise en forme

Besoins concernés : REU-04 (mail après colisage), SCR-08, PP-03, digest du matin. L'envoi lui-même (Apprise et outils de même usage) est mis de côté pour l'instant ; dans la maquette, les mails sont simulés.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [mjmlio/mjml](https://github.com/mjmlio/mjml) | 18 k | MIT | 10/2026 | Mise en forme de mails lisibles dans Outlook (tableaux d'alertes, récapitulatifs). |
| [resend/react-email](https://github.com/resend/react-email) | 20 k | MIT | 10/2026 | Modèles de mails en React, si SFER part en React. |
| [emilkowalski/sonner](https://github.com/emilkowalski/sonner) | 13 k | MIT | 08/2026 | Notifications à l'écran (React). |
| [caroso1222/notyf](https://github.com/caroso1222/notyf) | 3 k | MIT | 01/2023 | Notifications à l'écran en JavaScript simple ; peu actif. |

## 11. Scan, codes-barres, étiquettes, impressions

Besoins concernés : douchette, bagues, feuilles de stock, étiquettes rack, étiquettes colis Zebra.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [mebjas/html5-qrcode](https://github.com/mebjas/html5-qrcode) | 6 k | Apache-2.0 | 12/2025 | Lecture de codes-barres et QR par la caméra d'une tablette ou d'un téléphone (scan sans douchette). |
| ✅ [zxing-js/library](https://github.com/zxing-js/library) | 3 k | Apache-2.0 | 10/2026 | Moteur de lecture de codes-barres de référence (Code 128 compris). |
| [ericblade/quagga2](https://github.com/ericblade/quagga2) | 911 | MIT | 10/2026 | Lecture de codes-barres 1D par caméra. |
| ✅ [lindell/JsBarcode](https://github.com/lindell/JsBarcode) | 6 k | MIT | 06/2026 | Génération de codes-barres (Code 128) pour bagues, feuilles de stock, étiquettes rack. |
| [metafloor/bwip-js](https://github.com/metafloor/bwip-js) | 2 k | non standard | 08/2026 | Plus de 100 types de codes-barres ; *à confirmer* : licence de type MIT. |
| ✅ [BinaryKits/BinaryKits.Zpl](https://github.com/BinaryKits/BinaryKits.Zpl) | 410 | MIT | 08/2026 | Génération et aperçu d'étiquettes ZPL pour imprimantes Zebra, en .NET : cohérent avec la technologie du Circé actuel. |
| [parallax/jsPDF](https://github.com/parallax/jsPDF) | 31 k | MIT | 09/2026 | PDF dans le navigateur (fiches, étiquettes A4). |
| [bpampuch/pdfmake](https://github.com/bpampuch/pdfmake) | 12 k | non standard | 06/2026 | PDF à partir d'une description de document (fiche de synthèse) ; *à confirmer* : MIT. |
| [j-evins/glabels-qt](https://github.com/j-evins/glabels-qt) | 496 | GPL-3.0 | 09/2026 | Logiciel de conception d'étiquettes (bureau). |
| [teynon/ZPL-Label-Designer](https://github.com/teynon/ZPL-Label-Designer) | 202 | MIT | 05/2020 | Éditeur d'étiquettes ZPL ; ancien. |

## 12. Fichiers de prod (CSV, Excel) et contrôle des données

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [pandas-dev/pandas](https://github.com/pandas-dev/pandas) | 50 k | BSD-3-Clause | 10/2026 | Lecture des exports et découpage : déjà utilisé par l'outil Projet 1 et prévu pour le POC de la phase 6. |
| ✅ [unionai-oss/pandera](https://github.com/unionai-oss/pandera) | 4 k | MIT | 10/2026 | Contrôle automatique des exports (colonnes attendues, types, valeurs) : détecte un changement de format de l'export Circé. |
| [pola-rs/polars](https://github.com/pola-rs/polars) | 40 k | MIT | 10/2026 | Alternative plus rapide à pandas. |
| ✅ [mholt/PapaParse](https://github.com/mholt/PapaParse) | 14 k | MIT | 10/2026 | Lecture et écriture de CSV dans le navigateur. |
| [exceljs/exceljs](https://github.com/exceljs/exceljs) | 15 k | MIT | 01/2025 | Fichiers Excel mis en forme (bilan de génération) ; dernière activité en janvier 2025. |

## 13. Identification des orphelines : reconnaissance visuelle

Besoins concernés : REC-17, PR3, PROC-04. **Tout doit tourner en local** : les photos d'affiches sont des données clients.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [JohannesBuchner/imagehash](https://github.com/JohannesBuchner/imagehash) | 4 k | BSD-2-Clause | 10/2026 | Empreinte d'image très simple : retrouve un visuel identique ou presque. Premier niveau du POC. |
| ✅ [mlfoundations/open_clip](https://github.com/mlfoundations/open_clip) | 14 k | non standard | 09/2026 | Représentation d'images et de textes : compare la photo de l'affiche aux visuels Broadcast et au libellé saisi. |
| [openai/CLIP](https://github.com/openai/CLIP) | 34 k | MIT | 03/2026 | Modèle d'origine de CLIP. |
| [idealo/imagededup](https://github.com/idealo/imagededup) | 6 k | Apache-2.0 | 08/2025 | Détection de doublons d'images prête à l'emploi. |
| ✅ [facebookresearch/faiss](https://github.com/facebookresearch/faiss) | 41 k | MIT | 10/2026 | Recherche rapide du visuel le plus proche parmi des milliers. |
| [qdrant/qdrant](https://github.com/qdrant/qdrant) | 35 k | Apache-2.0 | 10/2026 | Base vectorielle, si la recherche doit vivre dans un service. |

## 14. Références métier : stock, entrepôt, MES

À lire pour s'inspirer (modèle de données, écrans, statuts), pas pour remplacer Circé.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| ✅ [inventree/InvenTree](https://github.com/inventree/InvenTree) | 8 k | MIT | 10/2026 | Stock avec emplacements, mouvements, étiquettes et codes-barres : très proche des besoins Stock et Réception. |
| [GreaterWMS/GreaterWMS](https://github.com/GreaterWMS/GreaterWMS) | 4 k | Apache-2.0 | 10/2026 | Gestion d'entrepôt (réception, rangement, expédition, scan). |
| [openboxes/openboxes](https://github.com/openboxes/openboxes) | 914 | EPL-1.0 | 10/2026 | Chaîne logistique : réceptions attendues et partielles, colisage. |
| [crbnos/carbon](https://github.com/crbnos/carbon) | 3 k | non standard | 10/2026 | ERP et MES moderne (interface soignée) : bonne référence d'ergonomie d'atelier. |
| [qcadoo/mes](https://github.com/qcadoo/mes) | 946 | non standard | 10/2026 | MES pour PME : ordres de fabrication, suivi d'avancement. |
| [odoo/odoo](https://github.com/odoo/odoo) | 55 k | non standard | 10/2026 | Modules stock et fabrication très complets ; *à confirmer* : édition communautaire en LGPL. |
| [frappe/erpnext](https://github.com/frappe/erpnext) | 40 k | GPL-3.0 | 10/2026 | ERP avec module fabrication. |

## 15. Outils internes « low-code » (prototypage rapide ou alternative)

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| [appsmithorg/appsmith](https://github.com/appsmithorg/appsmith) | 41 k | Apache-2.0 | 10/2026 | Écrans métier branchés sur une base de données, sans développement : utile pour un prototype sur données réelles hébergé en interne. |
| [refinedev/refine](https://github.com/refinedev/refine) | 36 k | MIT | 09/2026 | Cadre React pour applications de gestion : piste pour SFER. |
| [marmelab/react-admin](https://github.com/marmelab/react-admin) | 27 k | MIT | 10/2026 | Cadre React d'écrans d'administration, éditeur français. |
| [nocodb/nocodb](https://github.com/nocodb/nocodb) | 65 k | non standard | 10/2026 | Interface type Airtable sur une base existante ; licence à vérifier. |
| [ToolJet/ToolJet](https://github.com/ToolJet/ToolJet) | 41 k | AGPL-3.0 | 10/2026 | Comparable à Appsmith ; licence AGPL. |
| [Budibase/budibase](https://github.com/Budibase/budibase), [nocobase/nocobase](https://github.com/nocobase/nocobase), [directus/directus](https://github.com/directus/directus) | 28 k, 25 k, 38 k | non standard | 10/2026 | Autres plateformes ; licences à vérifier. |

---

## Mis de côté pour l'instant (décision du 14/10/2026)

Les relevés sont conservés pour le jour où ces sujets reviendront. Les dépôts de même usage que OR-Tools, Apprise et l'OCR sont rangés avec eux.

**Optimisation : fichiers de 20 tiroirs, ordonnancement, dispatch équitable.** Le dispatch reprendra d'abord ton programme Python existant.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| [google/or-tools](https://github.com/google/or-tools) | 14 k | Apache-2.0 | 10/2026 | Solveur CP-SAT (utilisable en Python) : répartir les trains en fichiers de 20 tiroirs au plus, en minimisant le nombre de fichiers et en respectant les départs ; répartir le roulage entre rouleurs (PR7, PR10). |
| [TimefoldAI/timefold-solver](https://github.com/TimefoldAI/timefold-solver) | 2 k | Apache-2.0 | 10/2026 | Planification sous contraintes (ex-OptaPlanner) : affectation de tâches à des personnes et à des machines. |
| [coin-or/pulp](https://github.com/coin-or/pulp) | 2 k | non standard | 10/2026 | Programmation linéaire simple en Python ; *à confirmer* : licence de type BSD. |
| [fontanf/packingsolver](https://github.com/fontanf/packingsolver) | 300 | MIT | 10/2026 | Solveurs de rangement (bin packing). |
| [secnot/rectpack](https://github.com/secnot/rectpack) | 564 | Apache-2.0 | 11/2021 | Rangement en 2D (racks, PR6) ; ancien. |

**Envoi des notifications (mail, Teams, push).** Dans la maquette, les mails sont simulés.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| [caronc/apprise](https://github.com/caronc/apprise) | 18 k | BSD-2-Clause | 10/2026 | Une seule bibliothèque Python pour envoyer vers mail, Teams et une centaine d'autres canaux. Simple pour les alertes d'un POC. |
| [novuhq/novu](https://github.com/novuhq/novu) | 40 k | non standard | 10/2026 | Infrastructure complète de notifications (préférences par utilisateur, digest) ; *à confirmer* : cœur libre, fonctions avancées payantes. |
| [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy) | 35 k | Apache-2.0 | 10/2026 | Notifications push sur téléphone ou poste (alertes d'atelier). |

**Lecture des BL (OCR).** À exécuter en local le jour venu : les BL sont des données clients.

| Dépôt | ★ | Licence | Activité | Intérêt |
|---|---|---|---|---|
| [PaddlePaddle/PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | 91 k | Apache-2.0 | 09/2026 | OCR performant : lire n° de BL, contrat, DA et quantités sur les bons de livraison. |
| [mindee/doctr](https://github.com/mindee/doctr) | 6 k | Apache-2.0 | 10/2026 | OCR de documents, très bon sur les tableaux de BL. |
| [docling-project/docling](https://github.com/docling-project/docling) | 69 k | MIT | 10/2026 | Extraction de tableaux depuis des PDF et des scans. |
| [tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract) | 77 k | Apache-2.0 | 10/2026 | OCR historique, robuste. |
| [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | 39 k | Apache-2.0 | 05/2026 | OCR dans le navigateur. |

## Points d'attention

- **Licences** : à privilégier MIT, Apache-2.0, BSD, ISC. À éviter ou à faire valider : AGPL (Grafana, ToolJet), GPL (ERPNext, gLabels), licences non commerciales (Handsontable) et toutes les mentions « non standard ».
- **Activité** : à écarter les dépôts archivés (tui.calendar) ou sans activité depuis plus de deux ans (ZPL-Label-Designer, rectpack, notyf, jkanban), sauf besoin ponctuel.
- **Confidentialité** : reconnaissance visuelle (et OCR, s'il revient) à exécuter en local ; pas de service en ligne pour les photos d'affiches ni pour les BL.
- **Cohérence avec la cible** : les librairies téléchargées valent pour la maquette. Le choix final (React ou non, .NET ou non) appartient à SFER. Cette liste sert à cadrer les attentes et à repérer ce qu'il ne faut pas redévelopper.
