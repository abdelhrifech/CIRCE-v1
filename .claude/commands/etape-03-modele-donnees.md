---
description: Étape 3 — Schéma Prisma, migrations, données de référence
---

Étape 3 de docs/MISSION.md : MODÈLE DE DONNÉES. Utilise la skill circe-migration-prisma.

1. Relis docs/ANALYSE_MODELE_DONNEES.md, docs/_travail/bdd.md, les règles métier des deux modules et les décisions de docs/QUESTIONS_OUVERTES.md.
2. Présente-moi d'abord un tableau : table réelle → modèle Prisma → conservée/modifiée/ajoutée/non reprise → justification (EX/RG). ATTENDS mon accord avant d'écrire le schéma.
3. Écris schema.prisma : entités réception, coordination, utilisateurs/profils, référentiels nécessaires, historiques de statut, journal d'audit, table d'idempotence. Champs version/created/updated sur les entités modifiables.
4. Migration initiale, relis le SQL.
5. Script `seed:ref` pour les données de référence (statuts, types… issus des RG, pas des MOCK).
6. Premières factories de test (apps/api/test/factories) pour chaque entité.
7. Test d'intégration qui vérifie les contraintes clés (FK, unicité, NOT NULL) sur la base de test.
8. Complète docs/ANALYSE_MODELE_DONNEES.md (modèle cible + journal des évolutions) et la matrice.
