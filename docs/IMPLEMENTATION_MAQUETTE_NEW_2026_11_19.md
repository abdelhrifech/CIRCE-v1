# Maquette-new — réalisation hors Réception et Coordination

## Périmètre autorisé

Source effective : `docs-sources/maquette-new`, identique à la livraison OneDrive du 16/11/2026 hors fichier système macOS `.DS_Store`. Le nom `docs-resources` indiqué par l’utilisateur désigne ce dossier dans le dépôt actuel. Sources consultées en lecture seule ; les données opérationnelles simulées ne sont pas reprises dans le code.

Gel explicite utilisateur : aucun changement dans les routes, composants, services et contrats Réception / Coordination ni dans les composants UI partagés. Les 152 empreintes sont versionnables dans `GEL_RECEPTION_COORDINATION_2026_11_19.json` et vérifiables par `node scripts/verifier-gel.mjs`. Vérification du 20/11 : **152/152 inchangés**. Les anciennes entrées de navigation Réception et ateliers sont conservées ; Stocks et Administration sont complétés.

Décision utilisateur : **« Activer comme la maquette pour Réception, chefs d’équipe et admin ; Coordination consulte »**, pour Fin de campagne. Cette décision concerne le nouveau module Stocks, sans modifier les écrans Réception. Le rebut conserve le refus existant d’une quantité supérieure au disponible ; aucun plafonnement silencieux. Les sorties physiques restent explicites et journalisées.

## Réalisation et traçabilité

| ID | Exigence / source | Code et résultat |
|---|---|---|
| EX-STK-NEW-001 | Stock et mouvements ; `stock.js:24–90` | Routes `/stocks` et `/stocks/mouvements` ; API `modules/stocks/lecture.ts`. Données réelles, stock = somme du journal, reçu incluant l’écart de contrôle, filtres, indicateurs, export et journal paginé. Aucun cache modifié à la consultation. |
| RG-STK-NEW-001 | Rebut et conservation ; `stock.js:8–18,80–90` | `modules/stocks/actions.ts` : lot atomique, contrôle préalable des versions et du périmètre, appels aux services Réception existants sans les éditer. Une erreur annule tout le lot. |
| RG-STK-NEW-002 | Fin de campagne ; `fincampagne.js:35–119`, `data.js:1269–1301` | `/stocks/fin-campagne`, `modules/stocks/fin-campagne.ts`. Décisions persistées/versionnées ; une affiche physique attribuée à son premier lien actif, sans compter son stock deux fois ; contrôle des départs connus dans attendues, faces, répartitions et instructions ; blocage si utilisation future. Conservation motivée et datée ; renvoi partiel puis destruction du reste ; confirmation physique obligatoire. Bordeaux/MUI signalés et traités individuellement. |
| RG-STK-NEW-002 | Délais et attention configurables ; `fincampagne.js`, `parametrage.js` | `/admin/fin-campagne`, `modules/stocks/configuration.ts` : valeurs de la maquette par défaut, édition admin, bornes et version. Une décision ne retire aucune affiche ; la destruction physique exige l’échéance. |
| EX-ADM-NEW-001 | Journal et statuts ; `parametrage.js:217–374` | `/admin/journal` : audit réel, filtres partiels et pagination. `/admin/statuts` : états réellement implémentés, catalogue cible et correspondances historiques distincts ; aucune transition existante modifiée. |
| EX-ADM-NEW-001 | Machines, transport, listes de distribution | `/admin/machines`, `/admin/transport`, listes dans `/admin/alertes` : registres persistés, création/édition, versions et audit. Transport affiche aussi les mappings existants avec pagination SQL et valide les destinations réelles. Configurations séparées des moteurs gelés, raccordement automatique non réalisé (voir limites). |
| EX-ADM-NEW-001 | Mails et gammes | `/admin/mails` consulte la file existante, avec distinction SIMULE/SMTP ; gammes de référence affichées dans `/admin/sites`. Aucun envoi SMTP déclenché par la consultation. |
| EX-PIL-NEW-001 | Analyse production ; `reprises.js:217–260` | `/pilotage/suivi` reçoit les filtres cumulés dossier, départ, atelier, format et annonceur. `/pilotage/analyse` conserve ses filtres et son détail ; ajoute une synthèse réelle par rouleur, machine connue, atelier, centre et départ. Une unité par train calculé selon Q-250. Activité/équipe non alimentée faute de modèle de douchage, dépendant de Réception gelée. |
| EX-PIL-NEW-001 | Pilotage, Bus et NC | Fonctionnalités du point publié du 17/11 conservées. Les limites de `EVOLUTIONS_MAQUETTE_2026_11_16.md` restent applicables ; cette livraison ne prétend pas les avoir toutes résolues. |
| EX-EXP-NEW-001 | Colis extérieurs ; `reprises.js:267–291` | `/expedition/exterieur` consulte les colis existants portant un code transporteur, avec période glissante et export. Aucun flux transporteur extérieur ni preuve de livraison inventés. |

Les constantes de `packages/shared/src/catalogue-maquette-reference.ts` sont des définitions de référence (gammes, statuts et correspondances), pas des JDD opérationnels.

## Données et compatibilité

Migration additive `20261119120000_fin_campagne` : tables FinCampagne, MachineConfiguration, BoucleTransportConfiguration et ListeDistributionConfiguration. Aucun effacement ni réinitialisation de la base de développement. Copie SQLite cohérente avant migration : `/private/tmp/circe-avant-maquette-new-20261120/dev.db`. Migration appliquée sur la base de développement le 20/11.

Les anciennes API `/api` restent disponibles ; les routes nouvelles sont également exposées sous `/v1` par le montage existant. Contrat OpenAPI régénéré. Les permissions supplémentaires `stock.consulter` (dont Expédition, sans droit sur les écrans Réception) et `stock.fin_campagne.agir` concernent uniquement Stocks ; admin conserve toutes les permissions, les profils Coordination consultent sans pouvoir sortir de stock.

Démarrage réel vérifié : `pnpm start --no-seed --user=dev.admin --web-port=3400 --api-port=3401 --admin-port=9380`. Application disponible sur `http://127.0.0.1:3400`. L’instance déjà ouverte sur 3000 provient d’un autre chemin de travail ; elle n’a pas été arrêtée ni remplacée. La commande habituelle `pnpm start` reste utilisable, avec choix de ports libres.

## Validation

- Empreintes du périmètre gelé : 152/152 inchangées.
- Parcours navigateur : conservation, renvoi puis destruction confirmée, rubriques Administration/colis extérieur et filtres/synthèse Pilotage ; inclus dans la recette globale.
- Vérification visuelle des pages Stocks et Fin de campagne sur la base de développement : chargement, indicateurs et tableaux réels présents.
- Tests d’intégration dédiés : sorties signées, permissions, périmètres, versions périmées, empreintes, rollback des lots, Bordeaux/MUI et programmation future. Les cas répartition future sans destinataire et reçu après contrôle ont été ajoutés après revue indépendante.
- TypeScript, lint, tests unitaires (18 partagés, 40 web, 243 API) et build vérifiés. Tests du lanceur : 2/2.
- Contrats OpenAPI applicatif et sondes régénérés et vérifiés.
- Intégration ciblée finale : **56/56 réussis**, dont les 17 cas Stocks et 5 Administration.
- Premier passage global : **3 749 réussis**, 1 échec attendu, 8 à faire ; interruption mémoire du processus Administration lors du chargement de 5 150 641 correspondances transport de la base de test. Correction : pagination SQL de la nouvelle vue Transport. Les **5 tests Administration ont ensuite réussi sur cette même base volumineuse** (1,73 s pour le fichier). Le passage global initial reste un passage interrompu ; aucun résultat de suite entièrement verte n’est inventé. Les 56 tests ciblés ont été rejoués sur une base neuve après correction.
- Recette E2E globale finale : **112/112 réussis**, incluant les parcours Réception, Coordination, Administration, Stocks, Pilotage et Roulage (1,5 minute).

## Limites restant explicites

1. Les nouveaux registres machines, boucles et distributions sont éditables et persistés, mais leur modification ne reconfigure pas les moteurs Coordination ni les destinataires SMTP existants. Leur raccordement doit être spécifié et testé dans un périmètre autorisant ces changements.
2. L’analyse d’activité par équipe dépend d’un modèle de douchage absent. Aucun chiffre de production ou taux de rebut fictif n’est affiché. Réception reste gelée.
3. La liste extérieure est une vue des références déjà enregistrées dans le suivi colis ; elle ne remplace pas l’import du fichier transporteur historique, ni une intégration Geodis complète. Boucle, poids, tarif et preuve de livraison ne peuvent pas être reconstitués sans leur source.
4. Le journal des mouvements est paginé après filtrage ; le chargement Stocks et certains calculs lisent encore les ensembles du périmètre en mémoire. Une pagination SQL complète et une recette de volume restent à mener avant de garantir de très gros volumes.
5. Les écarts d’écran et d’intégration antérieurs (macro-suivi, filtres NC, vues ateliers) restent tracés dans le rapport du 16/11. Les éléments dépendant de Réception/Coordination ne sont pas modifiés dans cette demande.
6. Le lanceur en une commande a été exécuté sur macOS ; la recette sur une machine Windows native reste à faire. Les prérequis et la commande Windows sont dans `README.md`.

**Verdict : nouveaux parcours implémentés et en recette, conformité intégrale au reste de la maquette non déclarée.** Les dépendances de données et les moteurs gelés imposent les limites ci-dessus.
