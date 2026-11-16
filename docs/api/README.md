# Contrats API CIRCE

## Routes et compatibilité

L’API principale expose les mêmes opérations sur `/v1/...` et sur le préfixe historique `/api/...`. Le front conserve ses appels `/api/...`. Aucun service métier, validateur Zod, droit, statut, transaction, calcul de stock ni format de réponse n’est remplacé pour cette évolution. Les nouvelles routes atteignent directement les mêmes gestionnaires ; ce ne sont pas des redirections HTTP.

Le contrat `circe-v1.openapi.json` décrit 166 chemins et 189 opérations, générés depuis les routes et les schémas Zod réellement enregistrés. Il couvre les corps, paramètres, réponses, fichiers binaires et erreurs structurées. L’API de sondes utilise un serveur et un contrat séparés : `circe-admin.openapi.json`.

Le numéro `1.0.0` des contrats désigne la première version de ces API. Cette intervention ne change pas le numéro de version fonctionnelle des composants ni la stratégie de livraison.

## Génération et contrôle

- `pnpm api:contract` : régénère les deux contrats, sans serveur, migration, JDD ou accès aux données.
- `pnpm api:contract:check` : échoue si les fichiers versionnés diffèrent des routes et schémas actuels.
- Le test `apps/api/test/api-version.int.test.ts` valide les contrats avec Swagger Parser, contrôle tous les chemins/méthodes et compare des parcours réels entre les deux préfixes.

Modifier une route ou un schéma implique de régénérer puis relire le contrat. Les transformations OpenAPI ne sont jamais réinjectées dans les validateurs et sérialiseurs d’exécution.

## Appels

Exemples sur le port API annoncé par le démarrage (souvent 3001, ou 3005 si les ports précédents sont occupés) :

```sh
curl http://127.0.0.1:3005/v1/health
curl http://127.0.0.1:3005/api/health
curl http://127.0.0.1:9180/healthz/live
curl http://127.0.0.1:9180/healthz/ready
```

Les clients de l’API doivent utiliser son origine ; le relais web historique continue de relayer `/api`. Le préfixe `/v1` n’est pas une nouvelle page du front.

Le filtre de centre reste `x-site-id`. Les POST conservent leur clé `Idempotency-Key` et leur comportement existant ; conserver le même chemin, la même clé et le même corps lors d’un rejeu. Une clé n’est pas une permission et ne remplace pas l’identité.

## Identité et exposition

Le contrat décrit honnêtement l’identité signée de développement actuellement implémentée (`x-dev-identity`). Il ne documente pas un Bearer qui n’existe pas. Les permissions des services s’appliquent de manière identique sous les deux préfixes, notamment l’accès global des administrateurs et les périmètres des autres profils.

`x-api-category` indique les opérations métier et le contrôle de santé technique. Le classement final et les origines Gateway restent à valider au cadrage Cityz. Les sondes du port 9180 ne doivent pas être exposées par les routes utilisateur.

Cette intervention traite le versionnement et les contrats de PLT-050/051/052. Elle ne met pas en place la Gateway, le SSO, un nouvel hébergement ou une nouvelle politique CORS ; ces sujets n’ont pas été autorisés dans ce lot.
