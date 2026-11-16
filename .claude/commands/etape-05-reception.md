---
description: Étape 5 — Implémenter UN sous-parcours du module Réception (ex /etape-05-reception REC-P01)
argument-hint: <ID du sous-parcours, ex REC-P01>
---

Étape 5 de docs/MISSION.md, sous-parcours **$ARGUMENTS** du module RÉCEPTION.

1. Lis la ligne $ARGUMENTS de docs/PLAN_IMPLEMENTATION.md, les RG correspondantes dans docs/RECEPTION_REGLES_METIER.md, les fiches ECR concernées et les décisions dans docs/QUESTIONS_OUVERTES.md.
   Si une question BLOQUANTE non tranchée concerne ce périmètre : arrête-toi et dis-le.
2. Annonce-moi la liste des RG/EX/ECR que tu vas couvrir et ce qui reste hors périmètre. Puis continue sans attendre.
3. Backend d'abord : machine d'états (skill circe-machine-etats), endpoints (skill circe-endpoint), tests unitaires + intégration au fil de l'eau.
4. Lance le sous-agent test-engineer sur ce périmètre pour compléter les tests à partir des règles documentées. Corrige le CODE si des tests révèlent des anomalies.
5. Écrans (skill circe-ecran), puis E2E Playwright du parcours.
6. Lance le sous-agent spec-auditor sur $ARGUMENTS. Corrige les écarts bloquants, relance-le jusqu'à verdict CONFORME ou jusqu'à ce que les écarts restants dépendent d'une question ouverte.
7. Mets à jour la matrice (statut FAIT / PARTIEL / BLOQUÉ, jamais FAIT si partiel), le plan, ECARTS et RAPPORT_TESTS.
   Résumé final : RG couvertes, tests (nb, résultats), écarts restants.
