---
description: Étape 7 — Valider toutes les interactions Réception ↔ Coordination, concurrence et cohérence
---

Étape 7 de docs/MISSION.md : INTERACTIONS MÉTIER.

1. Liste toutes les RG-X et, pour chacune, l'endroit du code qui l'implémente.
2. Construis la matrice d'impact : chaque transition de réception × état possible de la coordination liée (et inversement) → résultat attendu (autorisé, bloqué avec quelle règle, effet induit). Ajoute-la dans docs/ANALYSE_FONCTIONNELLE_COMPLETE.md.
3. Tests d'intégration pour CHAQUE cellule de cette matrice.
4. Tests de concurrence : actions simultanées sur réception et coordination liées (Promise.all de requêtes réelles) → pas d'état incohérent, un seul gagnant, l'autre 409.
5. Tests de rollback : échec forcé de l'effet induit → aucune écriture partielle.
6. E2E Playwright de bout en bout : réception → coordination, et dans l'autre sens si les specs le prévoient (retour, annulation, reprise).
7. Lance spec-auditor sur les RG-X. Mets à jour matrice, écarts, rapport de tests.
