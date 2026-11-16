---
description: Étape 9 — Générateurs de JDD reproductibles, exécution massive, corrections
---

Étape 9 de docs/MISSION.md : TESTS MASSIFS. Utilise la skill circe-jdd.

1. Écris les générateurs pour chaque famille de scénarios de la skill, en couvrant réception, coordination et leurs interactions.
2. Exécute avec au moins 3 seeds différentes et une volumétrie de plusieurs milliers d'enregistrements sur la base de test.
3. Ajoute des tests qui parcourent ces données : invariants (aucune coordination dans un état incompatible avec sa réception, historique cohérent avec le statut courant, aucune FK orpheline, versions croissantes…).
4. Mesure les temps des principales listes/filtres sous volumétrie.
5. Pour chaque anomalie : corrige le code (jamais le test pour masquer), ajoute un test de non-régression nommé `NR-<nnn> …`.
6. Remplis docs/RAPPORT_TESTS.md : commandes, seeds, volumes, résultats par catégorie, couverture (pnpm test --coverage), anomalies trouvées/corrigées, limites.
