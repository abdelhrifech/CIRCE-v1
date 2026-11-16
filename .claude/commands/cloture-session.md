---
description: À lancer à la fin de chaque session — met à jour plan, matrice, écarts et propose un commit
---

Clôture de session :

1. Mets à jour docs/PLAN_IMPLEMENTATION.md (section « Journal ») : date, étape/sous-parcours, ce qui est fait, ce qui reste, prochaine commande à lancer.
2. Vérifie que la matrice reflète l'état réel (statuts, fichiers, tests) pour tout ce qui a été touché.
3. Ajoute dans docs/QUESTIONS_OUVERTES.md toute question ou hypothèse apparue pendant la session.
4. Ajoute dans docs/ECARTS_EXISTANT_VS_CIBLE.md tout ce qui a été laissé de côté.
5. Lance `pnpm typecheck && pnpm lint && pnpm test` (si le projet existe) et rapporte le résultat.
6. Propose un message de commit conventionnel (ne commite pas, ne pousse pas).
