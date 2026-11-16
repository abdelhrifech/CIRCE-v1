# Versionnement API et observabilité — 12 novembre 2026

## Périmètre autorisé

Deux sujets uniquement : versionnement/contrats API et instrumentation/sondes. Aucune règle métier, schéma de données, migration, profil, stock, JDD ou écran modifié. Les fichiers des services métier ne sont pas modifiés. Les sujets SSO, autorisation centralisée, PostgreSQL, front statique/Caddy, CI/GitOps et conventions générales restent hors de ce lot.

## API

- Routes `/v1/...` ajoutées en conservant toutes les routes `/api/...` utilisées par l’interface.
- Les deux préfixes enregistrent le même plugin de routes et partagent les mêmes adaptateurs Broadcast/Mail/Machine, services, transactions et validateurs.
- Aucun redirect HTTP, changement d’en-tête d’authentification ou changement du format d’erreur/réponse.
- Contrat OpenAPI 3.1 généré : 166 chemins, 189 opérations ; schémas Zod convertis uniquement pour la documentation. Contrat séparé pour les deux sondes d’administration.
- Validation de syntaxe OpenAPI, correspondance des méthodes/chemins enregistrés, contrôle de fraîcheur et comparaisons réelles entre préfixes.

Contrats et limites d’exposition : `docs/api/README.md`, `docs/api/circe-v1.openapi.json`, `docs/api/circe-admin.openapi.json`.

## Observabilité

- SDK officiel OpenTelemetry initialisé avant Fastify/Pino/Prisma.
- Instrumentations officielles pour Fastify, HTTP entrant/sortant, fetch et Prisma ; métriques techniques et corrélation des logs.
- Export OTLP configuré par variables standard, sans collecteur obligatoire en développement local.
- Filtrage des attributs exportés ; aucun SQL, payload, query string, cookie ou jeton exporté dans les traces. Labels de métriques limités aux attributs techniques.
- Pino JSON sur stdout, canal unique ; horodatage, sévérité, corps, ressource et contexte de trace. Les logs ne sont plus présentés par pino-pretty, adaptation technique du format de journal uniquement.
- Serveur de sondes isolé : `/healthz/live` sans dépendance, `/healthz/ready` avec base et délai maximum, 503 pendant le drainage. Aucun de ces endpoints ajouté aux routes métier.
- Port serveur par défaut : 9180. Le démarreur local choisit un port libre à partir de 9180 si d’autres instances l’occupent, sans les arrêter. Les tests navigateur choisissent un port d’administration éphémère.

Configuration et diagnostic : `docs/operations/observabilite.md`.

## Tests spécifiques

- Sondes : base indisponible, réponse lente, drainage, séparation des routes et absence de requête de base sur live.
- Export : vrai processus API, vrai collecteur OTLP local ; traces serveur/Prisma/fetch sous la même trace, contexte de logs, ressources, métriques et absence des valeurs confidentielles de test.
- Collecteur indisponible : une requête applicative réussie reste réussie.
- API : identité, erreurs, fichiers binaires, rejeu idempotent d’un POST et contrats complets.
- Le moteur de migration du test est lancé avec ses diagnostics Rust propres pour éviter le niveau `warn` hérité de l’environnement desktop ; aucun réglage du moteur de l’application n’est changé.

## Validation d’ensemble

- 294 tests unitaires réussis (16 partagés, 36 web, 242 API).
- Intégration complète : 3 727 tests réussis ; 1 échec attendu, 8 à faire et 1 fichier ignoré restent explicitement signalés par la suite existante.
- Typage, ESLint/Prettier et build vérifiés ; contrôle de fraîcheur des contrats réussi.
- Premier contrôle réel : API historique et v1 répondent ; sondes sur une écoute distincte ; routes métier absentes du serveur d’administration ; identité administrateur toujours globale avec 64 permissions.

Les résultats navigateur et la relance finale sont consignés ci-dessous. Aucun déploiement Cityz n’est effectué. La plateforme doit fournir les variables du collecteur et vérifier la non-exposition du port d’administration. Cette évolution n’est pas une certification de conformité globale au PDF.


## Validation finale

- `pnpm test:e2e` : **108 parcours réussis** (réception, administration, coordination, roulage et expédition) avec l’interface et ses routes historiques.
- `pnpm test` : **294 tests unitaires réussis**.
- `pnpm test:int` : **3 727 tests réussis**, sans échec inattendu ; 1 échec attendu, 8 tests à faire et 1 fichier ignoré restent dans la suite.
- Les trois tests ciblés API/OTLP ont été rejoués après la dernière précision documentaire des types MIME : réussis. Les traces HTTP, Prisma et fetch sont vérifiées sous le même trace ID et les logs sont corrélés aux spans réellement reçus.
- `pnpm typecheck`, `pnpm lint` et `pnpm build` : réussis. Les derniers changements de métadonnées OpenAPI ont également passé typage, lint et validation du contrat. Les avertissements React/Radix de build restent non bloquants.
- `pnpm start:all --user=dev.admin` : réussi ; application sur `http://127.0.0.1:3000`, API sur `http://127.0.0.1:3005`. Aucune création de dossier par les graines à cette relance.
- Le port 9180 étant déjà occupé par une autre instance locale, le démarreur a choisi **9181** pour cette session. Les deux sondes répondent 200 ; une route métier demandée au serveur de sondes répond 404. Les routes `/api/health` et `/v1/health` répondent 200 ; les sondes ne sont pas exposées sur le serveur métier.
- L’interface ouverte sur la liste des affiches indique API « ok ». Le profil `dev.admin` conserve ses **64 permissions** et son périmètre global. La page de l’utilisateur n’a pas été changée pour cette vérification.

Le raccordement au collecteur Cityz demande ses valeurs `OTEL_*` et sa configuration de déploiement ; aucun secret, endpoint de production ou nouvel accès distant n’a été inventé. Le fonctionnement des exporteurs a été vérifié avec un collecteur OTLP local réel.
