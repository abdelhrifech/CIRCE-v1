---
description: Étape 1b — Synthèse : docs d'analyse, règles métier consolidées, matrice, écarts, questions ouvertes, plan
---

Étape 1b de docs/MISSION.md : SYNTHÈSE. Sources : docs/_travail/*.md (et retour aux sources originales en cas de doute). Aucun code applicatif.

Produis, en suivant les modèles déjà présents dans docs/ :

1. docs/ANALYSE_ARCHITECTURE_EXISTANTE.md
2. docs/ANALYSE_FONCTIONNELLE_COMPLETE.md
3. docs/RECEPTION_REGLES_METIER.md et docs/COORDINATION_REGLES_METIER.md :
   règles CONSOLIDÉES avec IDs définitifs, chacune marquée CONSERVÉE / MODIFIÉE / NOUVELLE / SUPPRIMÉE (supprimée seulement si une spec le dit explicitement), avec ses sources (legacy fichier:ligne + spec § + écran).
   Inclure la machine d'états complète et la matrice profils × actions.
   Inclure une section RG-X (interactions réception ↔ coordination).
4. docs/ANALYSE_MODELE_DONNEES.md (constat, sans encore écrire le schéma Prisma).
5. docs/ECARTS_EXISTANT_VS_CIBLE.md
6. docs/MATRICE_TRACABILITE_SPECIFICATIONS.md : une ligne par EX et par RG, colonnes implémentation/tests vides, statut « À FAIRE ».
7. docs/QUESTIONS_OUVERTES.md : TOUT conflit legacy/spec/maquette, toute ambiguïté, toute règle sans source. Marque BLOQUANTE celles qui empêchent de modéliser ou d'implémenter.
8. docs/PLAN_IMPLEMENTATION.md : découpage des étapes 5 et 6 en sous-parcours (REC-P01…, COO-P01…) de taille « une session », dans l'ordre de dépendance, avec les RG de chacun ; liste des dépendances indispensables pour l'étape 8.

Contrôle final : chaque EX de docs/_travail/specs-*.md et chaque écran ECR apparaît dans la matrice. Donne-moi le compte (EX trouvées / EX dans la matrice) et la liste des questions BLOQUANTES.
