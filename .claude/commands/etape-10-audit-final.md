---
description: Étape 10 — Audit final complet contre specs, maquettes et règles
---

Étape 10 de docs/MISSION.md : AUDIT FINAL.

1. Lance spec-auditor sur tout le périmètre Réception, puis Coordination, puis RG-X, puis dépendances (sessions d'agent séparées pour ne pas tronquer).
2. Vérifie que chaque EX/RG/ECR de la matrice a un statut honnête et des tests associés.
3. Exécute toute la chaîne : typecheck, lint, test, test:int, test:e2e, jdd avec 1 seed. Rapporte les vrais résultats.
4. Rédige docs/AUDIT_FINAL_CIRCE.md selon son modèle : fonctionnalités implémentées, règles prises en charge, parcours opérationnels, tests exécutés, anomalies corrigées, écarts restants, fonctionnalités non terminées, questions encore ouvertes, risques pour la mise en production (APIM, agent local, reprise de données…).
   Ne présente rien comme terminé si la matrice ne l'indique pas FAIT avec tests.
