# CIRCE V2 — Instructions projet pour Claude Code

## 1. Contexte

Reconstruction de CIRCE (client Cityz Media, programme Focus Performance 5) sur une nouvelle stack,
avec évolutions fonctionnelles. Modules prioritaires : **Réception** et **Coordination**.
La mission complète est dans `docs/MISSION.md`. Lis-la au début de toute étape.

## 2. Sources (LECTURE SEULE — toute écriture est bloquée par un hook)

- `circe-develop/` : code historique = référence des règles métier ACTUELLES.
- `docs-sources/` : spécifications, maquettes (avec données MOCK), schéma réel de la BDD
  = référence du comportement CIBLE.
- Priorité en cas de conflit : **ne jamais choisir seul**. Créer une question dans
  `docs/QUESTIONS_OUVERTES.md` et s'arrêter si elle est bloquante.

## 3. Stack (ne rien ajouter sans question validée)

- Monorepo pnpm : `apps/web`, `apps/api`, `packages/shared`.
- Web : TanStack Start + Router, React, TypeScript, Tailwind, Radix UI, Vite, Nitro (preset node).
  Le serveur web relaie `/api/*` vers l'API. Aucun accès BDD depuis le web.
- API : Node.js, TypeScript, REST, Prisma + SQLite (fichier local, adaptateur `better-sqlite3`). Décision de l'utilisateur du 2026-11-04 (Q-343) : plus de PostgreSQL ni de Docker. Les règles qui supposent PostgreSQL (index unique partiel, `bytea`, concurrence) sont réalisées avec les moyens de SQLite et tracées dans `ECARTS_EXISTANT_VS_CIBLE.md`.
- Validation : Zod (schémas dans `packages/shared`, réutilisés front et back).
- Tests : Vitest (unit + intégration), Playwright (E2E), fichier SQLite de test dédié (`apps/api/prisma/test.db`).
- PDF : générés côté navigateur uniquement.
- LLM éventuel : API compatible chat/completions, derrière une interface `LlmProvider`.

## 4. Commandes

- `pnpm dev` — web + api
- `pnpm start:all` — TOUT en une commande sur la base de dev : migrations, référentiels, un utilisateur de dev par rôle (`dev.coord`, `dev.recep`, `dev.cheq`, `dev.expe`, `dev.admin`, `dev.com`), puis API + web ; choisit des ports libres si 3000/3001 sont pris ; options `--user=dev.recep`, `--api-port=`, `--web-port=`, `--no-seed` ; Ctrl+C arrête tout (`scripts/start.mjs`)
- `pnpm db:up` / `pnpm db:test:up` — applique les migrations sur le fichier SQLite dev (`apps/api/prisma/dev.db`) / test (`test.db`) ; aucun serveur ni Docker
- `pnpm --filter @circe/api exec prisma migrate dev --name <nom>` (le nom de paquet est `@circe/api`, pas `api`)
- `pnpm typecheck` · `pnpm lint` (ESLint + Prettier) · `pnpm format` · `pnpm test` (unit, tous les paquets) · `pnpm test:int` (API, base `test.db`) · `pnpm test:e2e` (Playwright : lance API 3101 + web 3100 sur la base de test ; `pnpm exec playwright install chromium` une fois)
- Dev : web `http://127.0.0.1:3000`, API `http://127.0.0.1:3001`, relais `/api/*` assuré par la route `apps/web/src/routes/api/$.ts` (variable `API_URL`). Variables : `.env` (copié de `.env.example`) et `.env.test`.
- `pnpm dev:user <identifiant> <rôle> [plateformeId...]` : utilisateur de dev (base de dev) injecté par le relais web via `DEV_IDENTITY_USER` (Q-001, jamais en production)
- `pnpm seed:ref` (référentiels issus des RG : rôles, paramètres, types ; idempotent, base de dev) · `pnpm jdd --seed=<n> --volume=<n>` (JDD)
  (Commandes de l'étape 2 vérifiées le 2026-11-04. À maintenir à jour.)

## 5. Conventions d'identifiants (OBLIGATOIRES, utilisées partout : docs, code, tests)

- Exigence issue des specs : `EX-<MOD>-<nnn>` (MOD = REC, COO, TRA pour transverse, ADM…)
- Règle métier : `RG-<MOD>-<nnn>` ; règle inter-modules : `RG-X-<nnn>`
- Parcours : `REC-P01`, `COO-P01`…
- Écran : `ECR-<MOD>-<nn>` · Question : `Q-<nnn>` · Écart : `ECART-<nnn>`
- Chaque test porte l'ID de la règle testée dans son nom :
  `it('RG-REC-012 refuse la validation si le BL est absent', …)`
- Chaque fonction de service qui implémente une règle a un commentaire `// RG-REC-012`.

## 6. Conventions techniques

- API : `apps/api/src/modules/<module>/{routes,service,repository,schemas,permissions}.ts`.
  Les routes ne contiennent aucune logique métier. Le service contient les règles.
- Erreurs : format unique `{ code, message, details?, regle? }`, `regle` = ID RG violée.
  HTTP : 400 validation, 401, 403 permission, 404, 409 conflit/version/transition interdite, 422 règle métier.
- Statuts : une machine d'états par entité dans `service`, table de transitions explicite,
  toute transition non listée = 409. Chaque changement de statut écrit un historique.
- Atomicité : toute opération multi-écritures dans `prisma.$transaction`.
- Concurrence : verrouillage optimiste (champ `version`, `updateMany where version` → 409 si 0 ligne).
- Doubles soumissions : header `Idempotency-Key` sur les POST de création/transition.
- Permissions : vérifiées dans le service (pas seulement dans la route ni dans le front).
- Front : aucune donnée MOCK en dur. Toute donnée vient de l'API. États chargement / vide / erreur obligatoires.
- TypeScript strict, pas de `any`, pas de `@ts-ignore` sans commentaire justifié.

## 7. Règles non négociables

1. Ne jamais modifier `circe-develop` ni `docs-sources`.
2. Ne jamais inventer une règle métier : toute règle a une source (`fichier:ligne` ou `doc §/écran`).
   Sans source → `Q-xxx` dans `QUESTIONS_OUVERTES.md`.
3. Toute hypothèse non bloquante prise → notée `HYPOTHÈSE` dans la question, statut `HYPOTHÈSE PRISE`.
4. Ne jamais contourner une validation pour faire passer un test.
5. Ne jamais déclarer « terminé » sans la Definition of Done ci-dessous.
6. Ne jamais masquer un écart : tout ce qui n'est pas fait va dans `ECARTS_EXISTANT_VS_CIBLE.md`
   ou dans la colonne Statut de la matrice.
7. Tests exécutés uniquement sur la base de test (`DATABASE_URL` de `.env.test`).

## 8. Contexte d'intégration — À COMPLÉTER PAR L'ÉQUIPE

- **Profils utilisateurs** : à extraire du code historique à l'étape 1 et à valider sinon utilise des rock en premier temps

## 9. Workflow de chaque session

1. Lire `docs/PLAN_IMPLEMENTATION.md` (où on en est) et `docs/QUESTIONS_OUVERTES.md`.
2. Si une question `BLOQUANTE` non tranchée concerne le périmètre de la session → s'arrêter et la signaler.
3. Lister les RG/EX concernées AVANT de coder.
4. Coder par petits incréments, tests avec.
5. Terminer par `/cloture-session`.

## 10. Definition of Done (pour un parcours / une fonctionnalité)

- [ ] Toutes les RG du parcours implémentées, avec commentaire d'ID.
- [ ] Chaque RG a au moins un test nominal ET un test de rejet.
- [ ] Transitions interdites testées (409).
- [ ] Permissions testées pour chaque profil (autorisé ET refusé).
- [ ] Écran conforme à la maquette (structure, colonnes, filtres, actions, messages, états vide/chargement/erreur).
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:int` au vert.
- [ ] E2E Playwright du parcours nominal au vert.
- [ ] Matrice mise à jour (statut, fichiers, tests).
- [ ] Agent `spec-auditor` passé, écarts reportés.
