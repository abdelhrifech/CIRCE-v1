---
description: Étape 1a — Analyse brute des 3 sources en parallèle par les sous-agents (aucun code)
---

Étape 1a de docs/MISSION.md : AUDIT DES SOURCES. Tu n'écris AUCUN code applicatif.

1. Inventaire : liste le contenu de circe-develop (technos, modules, volumétrie approximative) et de docs-sources (chaque document, chaque maquette, le schéma BDD). Écris-le dans docs/_travail/inventaire.md. Signale tout fichier que tu ne peux pas lire.

2. Lance EN PARALLÈLE les sous-agents suivants :
   - legacy-analyst sur le module Réception, puis un second sur le module Coordination,
   - spec-analyst sur Réception + Coordination + exigences transverses (auth, profils, menus, impressions, PDF),
   - mockup-analyst sur TOUTES les maquettes (pas seulement réception/coordination : il faut repérer les dépendances),
   - db-analyst sur le schéma réel.

3. Quand ils ont terminé, lance un legacy-analyst complémentaire sur les modules dont Réception et Coordination dépendent (repérés dans les rapports).

4. Rends-moi : la liste des fichiers produits dans docs/_travail/, le nombre de règles/exigences/écrans trouvés par source, les zones non analysées, et les 10 points qui t'inquiètent le plus.

Ne passe pas à la synthèse : je relis d'abord.
