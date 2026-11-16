---
name: circe-endpoint
description: Procédure obligatoire pour créer ou modifier un endpoint REST de l'API CIRCE (route, schéma Zod, service, permission, transaction, verrouillage optimiste, idempotence, tests). À utiliser dès qu'on touche apps/api/src/modules.
---

# Créer un endpoint CIRCE

## 0. Avant de coder

- Lister les RG/EX implémentées par cet endpoint (IDs).
- Vérifier qu'aucune question BLOQUANTE ouverte ne les concerne.

## 1. Schémas — `packages/shared/src/<module>/schemas.ts`

- Schéma Zod d'entrée (body, params, query) et de sortie.
- Messages d'erreur en français, alignés sur les maquettes quand elles en montrent.
- Exporter les types : `export type CreerReceptionInput = z.infer<typeof creerReceptionSchema>`.

## 2. Permission — `apps/api/src/modules/<module>/permissions.ts`

- Une permission nommée par action : `reception:valider`.
- Mapping profil → permissions dans `apps/api/src/core/auth/roles.ts` (source : doc règles métier).

## 3. Service — `.../<module>/service.ts`

Ordre imposé dans chaque méthode :

1. `assertPermission(ctx, 'reception:valider')` → 403
2. charger l'entité → 404
3. contrôles de règles métier (chacun avec `// RG-xxx`) → `BusinessError(code, message, 'RG-xxx')` → 422
4. contrôle de transition via la machine d'états (skill circe-machine-etats) → 409
5. écritures dans `prisma.$transaction(async (tx) => { … })` :
   - update avec `where: { id, version }` + `version: { increment: 1 }` ; 0 ligne → `ConflictError` 409
   - historique de statut / journal d'audit dans la MÊME transaction
   - effets sur l'autre module (ex : coordination) dans la MÊME transaction si les specs les rendent indissociables
6. retourner le DTO de sortie (jamais l'objet Prisma brut).

## 4. Route — `.../<module>/routes.ts`

- Parse (Zod) → appelle le service → renvoie. AUCUNE règle métier ici.
- POST de création/transition : lire `Idempotency-Key`, utiliser `withIdempotency(key, ctx.userId, fn)`.

## 5. Tests (au même moment, pas après)

- `service.test.ts` (unitaire, règles) et `routes.int.test.ts` (intégration base de test).
- Minimum par endpoint : nominal, validation 400, permission 403, introuvable 404,
  règle 422 (une par RG), transition interdite 409, conflit de version 409, idempotence.
- Noms des tests préfixés par l'ID de la règle.

## 6. Traçabilité

- Ajouter/mettre à jour les lignes de la matrice : ID → `fichier:fonction` → tests.
