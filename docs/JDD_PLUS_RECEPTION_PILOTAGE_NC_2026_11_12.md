# JDD+ — Réception, pilotage et non-conformités

Lot du 12 novembre 2026 (2026-W46), exclusivement fictif, ajouté à la base de développement après sauvegarde. Aucun ancien JDD supprimé ni règle métier modifiée. Les plateformes restent Wissous, Nîmes et Nanterre.

## Volumes et couverture

- 141 dossiers supplémentaires : 47 par centre.
- 150 scénarios : les 141 dossiers et 9 inconnues autonomes.
- 144 affiches supplémentaires, dont des compléments conservant leur numéro d’affiche.
- 75 non-conformités : 25 par centre, avec les 13 types réception et les 6 types agence ; déclarations depuis une réception, une inconnue et un formulaire autonome.
- Pour chaque centre : 4 NC à décider, 5 en cours plateforme, 9 traitées et 7 pour statistiques. Les neuf décisions et le traitement par le chef d’équipe sont représentés. Les justificatifs joints sont des fichiers techniques fictifs, sans données personnelles.
- Formats : 2 m² fixe et déroulant principalement, 4/8 m² déroulant, 4/8/12 m² colle.
- Semaines : courante majoritaire, départ passé, S+1 et S+2. Les échéances et indicateurs restent calculés par les règles réelles : un compteur à zéro est possible selon le jour de consultation ; aucune date de règle n’est falsifiée pour le remplir.

## Retrouver les données

Rechercher **JDD+** dans les attendus, affiches, dossiers ou non-conformités ; choisir le centre dans le bandeau. Les notes et la disposition personnelles du tableau de bord ne sont pas modifiées. Les sections J−3 restent celles des spécifications : Wissous 1, Wissous 2 et Nîmes ; aucun tableau Nanterre n’est inventé. Les nouveaux dossiers éligibles sont ajoutés explicitement, avec annotations, impact, GO/NO GO et surcoûts fictifs.

Les inconnues ayant une feuille définitive peuvent nécessiter d’élargir le filtre des statuts, car le filtre métier par défaut les exclut.

## Catalogue commun aux trois centres

Chaque scénario ci-dessous existe dans chacun des trois centres. Le catalogue JSON contient les numéros de dossiers, affiches et NC : `docs/_travail/jdd-plus-2026-W46.json`.

| Scénario | Exemple de dossier à Wissous |
|---|---|
| 2m fixe · attendu sans IP | 4046000 |
| 2m déroulant · attendu avec IP | 4046001 |
| 2m fixe · réception partielle 35 sur 100 | 4046002 |
| 2m déroulant · complète à contrôler | 4046003 |
| 2m fixe · surplus 125 sur 100 | 4046004 |
| 2m déroulant · contrôle validé, feuille à imprimer | 4046005 |
| 2m fixe · validation administrative attendue | 4046006 |
| 2m déroulant · contrôlée et validée | 4046007 |
| 2m fixe · comptage 90 pour BL de 100 | 4046008 |
| 2m déroulant · complément 40 puis 60 | 4046009 |
| 2m fixe · sans BL, doute à confirmer | 4046010 |
| 2m déroulant · 10 affiches au rebut | 4046011 |
| 2m fixe · surplus entretien de 20 | 4046012 |
| 2m déroulant · feuille déjà imprimée | 4046013 |
| 4 m² scro · manque à J−3 | 4046014 |
| 8 m² scro · manque à J−3 | 4046015 |
| 12 m² colle · manque à J−3 | 4046016 |
| 8 m² colle · manque à J−3 | 4046017 |
| 4 m² colle · manque à J−3 | 4046018 |
| NC réception · Affiches trempées ou abîmées | 4046019 |
| NC réception · Encre qui a coulé | 4046020 |
| NC réception · Erreur de format (ex. scro reçu à la place de colle) | 4046021 |
| NC réception · Erreur de papier | 4046022 |
| NC réception · Casse à la production | 4046023 |
| NC réception · Thèmes mélangés | 4046024 |
| NC réception · Formats mélangés | 4046025 |
| NC réception · Palettes non conformes | 4046026 |
| NC réception · Croix mal positionnées | 4046027 |
| NC réception · Écart de quantité | 4046028 |
| NC réception · Rouleaux au lieu de palettes | 4046029 |
| NC réception · BL non conforme | 4046030 |
| NC réception · Papier de mauvaise qualité | 4046031 |
| NC quantité · non bloquante | 4046032 |
| NC croix · non bloquante | 4046033 |
| NC multiple · décision et traitement plateforme | 4046034 |
| NC agence · Affiches Non Reçues ou Quantité livrée insuffisante | 4046035 |
| NC agence · Assemblage Non Conforme | 4046036 |
| NC agence · Bandeaux non reçus | 4046037 |
| NC agence · Palette/Colis/Affiches reçus abîmés | 4046038 |
| NC agence · Papier de mauvaise qualité / Qualité zip | 4046039 |
| NC agence · Reçu mauvaises affiches / bandeaux | 4046040 |
| NC formulaire · visuel non conforme | 4046041 |
| NC formulaire · papier pour statistiques | 4046042 |
| 2m fixe · réception sans IP avec intitulé saisi | 4046043 |
| Inconnue rattachée · à contrôler | 4046044 |
| Inconnue contrôlée · feuille définitive à imprimer | 4046045 |
| Inconnue · feuille définitive imprimée | 4046046 |
| JDD+ inconnue 2026-W46 Wissous · sans BL | Inconnue autonome |
| JDD+ inconnue 2026-W46 Wissous · avec BL et NC | Inconnue autonome |
| JDD+ inconnue 2026-W46 Wissous · signalée introuvable | Inconnue autonome |

## Construction et vérification

`pnpm seed:scenarios` exécute `apps/api/scripts/seed-scenarios.ts`. Le démarrage habituel l’appelle après les graines des centres et des nouvelles spécifications. Les numéros sont déterministes par semaine, centre et scénario. Les scénarios existants ne sont pas réinitialisés : les essais effectués dans l’application sont conservés.

Chaque scénario est créé dans une transaction. Les réceptions, compléments, contrôles, rebut, surplus entretien, rattachements d’inconnues, validations administratives, impressions, NC, décisions et saisies J−3 passent par les services de l’application. Les dossiers et lignes attendues initiaux constituent les données amont fictives. Les états finaux ne sont pas imposés par une mise à jour SQL.

Vérifications : types TypeScript, ESLint et Prettier ; exécution réelle des services ; cohérence SQLite et clés étrangères ; cohérence des mouvements et caches de stock de toutes les nouvelles affiches ; cohérence des centres des rattachements ; lecture des API par centre et globalement ; relance sans nouvelle création et sans modification des tables par la graine.

Cette série couvre les états et variantes listés. Les combinaisons invalides (stock négatif, mauvais périmètre, doublon non confirmé, conflit de version…) restent des cas de tests : elles ne sont pas enregistrées comme des données métier valides. La série ne prétend pas énumérer toutes les combinaisons mathématiquement possibles ni simuler des services externes non raccordés.


## Résultat de la relance finale

`pnpm start:all --user=dev.admin` : application prête sur `http://127.0.0.1:3000`, zéro nouveau dossier à recréer. Les six API de réception, affiches, dossiers, NC et pilotage répondent 200 globalement et pour chacun des trois centres (24 lectures). L’indicateur « Réceptions sans IP » contient trois nouveaux cas (un par centre). Les trois sections J−3 sont alimentées. Le sélecteur contient uniquement Wissous, Nîmes et Nanterre.

Une seconde exécution de `pnpm seed:scenarios` a été comparée par empreinte de chaque table : aucune donnée modifiée. Le contrôle des stocks porte sur les 144 nouvelles affiches ; il ne certifie pas les anciens jeux E2E hérités.


## Complément sans IP et échéances

La série a ensuite été enrichie de 72 dossiers supplémentaires (catalogue total : 222 scénarios). Les volumes ci-dessus décrivent le premier chargement. Voir `JDD_SANS_IP_ECHEANCES_2026_11_12.md` pour les 39 réceptions sans IP et le calendrier réel d’entrée des dossiers dans l’indicateur d’échéance J−3.
