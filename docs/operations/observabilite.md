# Observabilité de l’API CIRCE

## Périmètre

Instrumentation technique uniquement. Les services métier, états, droits, données et parcours du front sont conservés. `/api/health` reste disponible avec sa réponse et son contrôle de base existants ; `/v1/health` en est l’équivalent versionné.

Le démarrage initialise le SDK officiel OpenTelemetry avant le chargement de Fastify, Pino et Prisma. Instrumentations : `@fastify/otel`, HTTP Node, Undici/fetch, Prisma et Pino. Les bibliothèques sont verrouillées dans pnpm. Le collecteur distant ne constitue jamais une dépendance de disponibilité de l’application.

## Sondes isolées

| Écoute | Requête | Succès | Échec |
|---|---|---|---|
| Administration, port 9180 | `GET /healthz/live` | 200, `status: alive` | Le processus doit pouvoir répondre ; aucune dépendance interrogée. |
| Administration, port 9180 | `GET /healthz/ready` | 200, `status: ready` | 503, `status: not_ready` si la base indispensable échoue, dépasse le délai ou si l’arrêt est commencé. |

Le serveur de sondes ne contient aucune route métier ni middleware d’identité. Les routes API ne contiennent pas les sondes. Il n’écoute qu’en local par défaut ; `ADMIN_HOST` permet de choisir l’interface requise par la plateforme. Ne pas publier ce port sur une route utilisateur et ne pas y créer de relais web.

| Variable technique | Défaut | Usage |
|---|---|---|
| `ADMIN_PORT` | `9180` | Port d’administration ; `0` uniquement pour attribuer un port éphémère dans les tests et exécutions parallèles. |
| `ADMIN_HOST` | `127.0.0.1` | Interface d’écoute ; choisir celle du conteneur pour les sondes Kubernetes. |
| `ADMIN_READY_TIMEOUT_MS` | `2000` | Délai maximum du contrôle de disponibilité. |

SIGTERM marque d’abord les sondes non prêtes, puis conserve l’arrêt de Fastify/base et des traitements existants, ferme le serveur d’administration et demande le flush/arrêt du SDK. Les échecs d’export de télémétrie ne sont pas des échecs métier. Une collision de port en lancement direct est une erreur de configuration explicite ; le serveur principal n’est pas laissé seul après l’échec de son démarrage associé.

En développement, `pnpm start:all` recherche un port de sondes libre à partir de 9180 (option `--admin-port=` ou valeur `ADMIN_PORT` du `.env`) et affiche l’URL retenue. Cela permet de conserver plusieurs instances locales existantes sans les arrêter. Le serveur conserve 9180 comme défaut ; le déploiement cible doit fixer ce port conformément au référentiel. Les E2E utilisent un port d’administration éphémère afin de ne pas entrer en conflit avec le développement.

## Traces et métriques OTLP

L’export est configuré exclusivement par les variables standard OpenTelemetry. Aucune adresse de collecteur ni aucun secret n’est codé en dur.

```sh
# Valeurs à fournir par la plateforme ; ne pas copier un secret dans ce document.
OTEL_EXPORTER_OTLP_ENDPOINT=https://collecteur-fourni-par-la-plateforme
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=circe-api
OTEL_RESOURCE_ATTRIBUTES=service.namespace=circe,service.version=tag-du-build,deployment.environment.name=staging
```

Variables prises en charge : endpoints, protocoles et en-têtes OTLP communs ou spécifiques aux traces/métriques ; `OTEL_TRACES_EXPORTER=none` et `OTEL_METRICS_EXPORTER=none` ; échantillonnage `OTEL_TRACES_SAMPLER*` ; fréquence `OTEL_METRIC_EXPORT_INTERVAL` ; limites et délais `OTEL_BSP_*` ; `OTEL_SDK_DISABLED=true`. Protocoles traces : `http/protobuf`, `http/json`, `grpc`. Le SDK choisit l’export des métriques à partir de ses variables standard.

Sans endpoint OTLP, le démarrage local n’émet ni traces ni métriques vers une adresse implicite localhost : aucun collecteur n’est nécessaire pour travailler comme avant. Les logs techniques continuent. Les valeurs par défaut des attributs identifient le développement ; la plateforme doit fournir le nom de tenant, l’environnement et le véritable tag du build. L’export ne prouve pas, à lui seul, leur bon renseignement sur Staging.

Les spans couvrent HTTP entrant/sortant et les opérations Prisma. Les enregistrements exportés sont filtrés : aucun SQL, paramètre SQL, corps de requête, cookie, jeton, URL brute avec query string ou texte d’exception n’est conservé. Les routes sont exprimées par leur modèle (`/v1/photos/:id`) ; les attributs techniques autorisés sont explicitement listés dans l’exporteur.

| Métrique | Unité | Sens / attributs |
|---|---|---|
| `http.server.request.duration` (scope `circe.api`) | secondes | Durée de réponse, méthode, modèle de route, code HTTP. |
| `circe_api_requests` | requêtes | Nombre de réponses terminées, mêmes attributs à faible cardinalité. |

Aucun utilisateur, dossier, centre, URL brute ou payload n’est ajouté aux labels. Les instrumentations officielles peuvent également émettre leurs métriques HTTP techniques. Ces mesures n’ajoutent aucune règle de gestion et ne remplacent pas les indicateurs métier à définir avec la plateforme. Aucun seuil d’alerte métier n’est inventé dans ce lot.

## Journaux

Pino reste le canal unique de logs applicatifs, en JSON sur stdout : horodatage ISO, sévérité, corps, attributs nommés, ressource et identifiants de trace/span lorsqu’un contexte de trace actif est disponible. Le niveau reste contrôlé par `LOG_LEVEL`. Les query strings sont retirées de l’URL journalisée ; les en-têtes sensibles sont masqués. Le SDK n’envoie pas de second flux de logs OTLP (`disableLogSending` et absence de processors de logs).

## Diagnostic et vérifications

- Live 200 mais ready 503 : vérifier base/configuration et délai ; ne pas transformer le test de vie en test de dépendance.
- Absence d’export : vérifier endpoints, protocole, variables `none`/SDK disabled, échantillonnage et accès réseau au collecteur. Une panne de collecteur ne doit pas faire échouer une réception.
- Le test `apps/api/test/observability.int.test.ts` lance un collecteur HTTP local et un vrai processus API instrumenté. Il vérifie les traces serveur/client/Prisma, les métriques, les ressources, la corrélation des logs, le filtrage des données et la continuité de service si le collecteur disparaît.
- Les tests unitaires de sondes couvrent base indisponible, dépendance lente, absence de requête de base pour live, drainage et séparation des routes.

Aucun collecteur de production, HTTPRoute, secret, tableau Grafana ou réglage de plateforme n’est créé par cette intervention. Le branchement au collecteur Cityz et la non-exposition du port 9180 doivent être vérifiés au déploiement.
