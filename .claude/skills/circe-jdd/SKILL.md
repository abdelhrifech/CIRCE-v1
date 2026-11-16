---
name: circe-jdd
description: Procédure pour écrire les factories et générateurs de jeux de données (JDD) reproductibles de CIRCE V2 : seeds configurables, volumétrie, données valides et invalides, sans données personnelles réelles.
---

# Jeux de données CIRCE

## Principe

On n'écrit JAMAIS des milliers de lignes de données à la main. On écrit des GÉNÉRATEURS déterministes.

## Organisation : `apps/api/test/`

- `factories/` : une factory par entité, `build(overrides)` (objet) et `create(tx, overrides)` (en base), respect des FK (crée les parents si absents).
- `jdd/scenarios/` : un fichier par famille :
  `nominal`, `incomplet`, `limites`, `invalides`, `statuts` (au moins une entité par statut),
  `profils`, `rejets-reprises`, `doublons`, `transitions-interdites`, `inter-modules`, `concurrence`, `volumetrie`.
- `jdd/run.ts` : CLI `pnpm jdd --seed=42 --volume=5000 --scenarios=nominal,statuts`.

## Règles

- Aléatoire uniquement via `@faker-js/faker` avec `faker.seed(seed)` → même seed = mêmes données.
- Locale `fr` ; noms, adresses, téléphones fictifs. Aucune donnée réelle, y compris issue du code historique ou des MOCK si elles semblent réelles.
- Les scénarios VALIDES passent par les services métier (pas d'insert direct qui contournerait les règles) quand c'est réaliste en temps ; sinon insert direct + test de cohérence après.
- Les données INVALIDES ne sont jamais insérées : elles alimentent des tests paramétrés qui vérifient le rejet (code + `regle`).
- Chaque scénario documente en tête : RG couvertes, nombre d'enregistrements, état attendu.
- Volumétrie : mesurer et consigner les temps des listes/filtres principaux dans RAPPORT_TESTS.md.
- Uniquement sur la base de test (vérifier `DATABASE_URL` contient la base de test, sinon arrêter).
