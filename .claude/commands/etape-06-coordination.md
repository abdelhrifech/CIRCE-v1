---
description: Étape 6 — Implémenter UN sous-parcours du module Coordination (ex /etape-06-coordination COO-P01)
argument-hint: <ID du sous-parcours, ex COO-P01>
---

Étape 6 de docs/MISSION.md, sous-parcours **$ARGUMENTS** du module COORDINATION.

1. Lis la ligne $ARGUMENTS de docs/PLAN_IMPLEMENTATION.md, les RG correspondantes dans docs/COORDINATION_REGLES_METIER.md, les fiches ECR concernées et les décisions dans docs/QUESTIONS_OUVERTES.md.
   Si une question BLOQUANTE non tranchée concerne ce périmètre : arrête-toi et dis-le.
2. Annonce-moi la liste des RG/EX/ECR que tu vas couvrir et ce qui reste hors périmètre. Puis continue sans attendre.
3. Backend d'abord : machine d'états (skill circe-machine-etats), endpoints (skill circe-endpoint), tests unitaires + intégration au fil de l'eau.
4. Lance le sous-agent test-engineer sur ce périmètre pour compléter les tests à partir des règles documentées. Corrige le CODE si des tests révèlent des anomalies.
5. Écrans (skill circe-ecran), puis E2E Playwright du parcours.
6. Lance le sous-agent spec-auditor sur $ARGUMENTS. Corrige les écarts bloquants, relance-le jusqu'à verdict CONFORME ou jusqu'à ce que les écarts restants dépendent d'une question ouverte.
7. Mets à jour la matrice (statut FAIT / PARTIEL / BLOQUÉ, jamais FAIT si partiel), le plan, ECARTS et RAPPORT_TESTS.
   Résumé final : RG couvertes, tests (nb, résultats), écarts restants.

Attention particulière : pour toute action de coordination qui dépend de l'état d'une réception (ou qui la modifie), implémente et teste les règles RG-X correspondantes dans la même transaction, et teste le cas où la réception n'est pas dans l'état requis.
