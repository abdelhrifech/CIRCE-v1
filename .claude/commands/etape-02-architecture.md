---
description: Étape 2 — Créer le monorepo avec la stack imposée, outillage qualité, bases dev/test
---

Étape 2 de docs/MISSION.md : ARCHITECTURE. Vérifie d'abord dans docs/QUESTIONS_OUVERTES.md qu'aucune question BLOQUANTE ne porte sur l'architecture.

1. Propose-moi d'abord (sans coder) les choix non imposés par CLAUDE.md, avec 1 phrase de justification chacun : framework HTTP de l'API (léger, ex : Fastify), structure des dossiers, gestion des variables d'env, stratégie de logs, versions (pinnées, publiées depuis plus de 2 semaines). ATTENDS mon accord.

2. Après accord, crée :
   - monorepo pnpm : apps/web (TanStack Start + Router + Nitro preset node + Tailwind + Radix), apps/api (Node TS + Prisma + adaptateur PostgreSQL), packages/shared (Zod, types) ;
   - proxy /api du serveur web vers l'API ;
   - docker-compose : postgres-dev (5432), postgres-test (5433), volumes séparés ;
   - .env.example, .env.test (pointant sur la base de test) ;
   - TypeScript strict partout, ESLint, Prettier, Vitest, Playwright ;
   - scripts racine : dev, build, typecheck, lint, test, test:int, test:e2e, db:up, db:test:up, seed:ref, jdd ;
   - socle d'erreurs (BusinessError, ConflictError…), middleware resolveIdentity, interfaces SiteAgentPort + MockSiteAgent et LlmProvider (vides) comme décrit dans CLAUDE.md §8 ;
   - une page web et un endpoint /api/health de bout en bout, avec un test d'intégration et un test E2E.

3. Vérifie : `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e`.
4. Mets à jour CLAUDE.md §4 si des commandes diffèrent, et docs/PLAN_IMPLEMENTATION.md.
