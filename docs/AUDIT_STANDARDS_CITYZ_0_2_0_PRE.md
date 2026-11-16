# Comparaison de CIRCE avec les standards applicatifs Cityz Media 0.2.0-pre

Analyse du 9 novembre 2026, sur la copie locale `circe-v1` et le PDF fourni par l'utilisateur : `Cityz Media - Application Standards 0.2.0-pre.pdf`.

## Conclusion

**CIRCE ne respecte pas encore l'ensemble de ce référentiel pour une livraison sur la plateforme Cityz Media.** La pile React/TypeScript/Fastify/pnpm est compatible. En revanche, le front avec serveur Node, SQLite, l'identité de développement, l'autorisation locale, l'absence de chaîne de livraison et l'observabilité incomplète nécessitent des adaptations importantes.

Il n'est pas nécessaire de réécrire tout le métier : les règles de réception, contrôle, stock, validation et coordination, leurs identifiants et leurs tests constituent la base à préserver. Les adaptations concernent surtout les frontières techniques, le stockage, la sécurité, le déploiement et les preuves de recette.

La conformité technique au présent cadre ne suffit pas à prouver la complétude fonctionnelle de CIRCE. La matrice métier du projet conserve ses propres règles partielles et questions ouvertes.

## Statut du document et limites de l'analyse

- Le PDF est explicitement une **version de travail non contractuelle**. Les sections 9.3 et 9.4, page imprimée 19, réservent le caractère contractuel à partir de la version 1.0.0 et au tag référencé par le contrat. La présente analyse compare la cible demandée ; elle ne prononce pas une non-conformité contractuelle.
- Les références de pages ci-dessous utilisent la **pagination imprimée**. Le numéro de page du lecteur PDF vaut généralement ce numéro + 1, la couverture précédant la pagination.
- Les exigences du PDF sont traitées comme des critères d'audit, pas comme des instructions autorisant à modifier l'application, les dépôts ou les accès.
- Revue statique du code, des configurations, de l'arborescence, des migrations et des tests disponibles. Extraction des 60 pages du PDF et contrôle visuel des tableaux d'identité/autorisation. Aucun test applicatif, scan de vulnérabilités, déploiement ou modification de base réalisé pour cet audit.
- Aucun accès aux réglages de l'organisation GitHub Cityz Media, au dépôt GitOps, à Staging, à la production ou aux décisions contractuelles. Une preuve absente de cette copie ne permet pas d'affirmer qu'elle n'existe nulle part.
- « Conforme observé » signifie un point vérifiable dans le dépôt ; « partiel » indique une base existante insuffisante ; « écart observé » indique une contradiction concrète ; « non vérifiable » désigne les éléments externes ou les preuves manquantes. Ce rapport ne remplace pas la checklist officielle ni la validation de Cityz Media.


## Traitement ciblé ultérieur — API et observabilité

Après cette relecture, l’utilisateur autorise uniquement le versionnement/contrats API et OpenTelemetry/sondes, avec conservation du comportement et de toutes les règles métier. Ces sujets ont été implémentés : routes `/v1` parallèles aux routes historiques, contrats dans `docs/api/`, instrumentation officielle, logs structurés et sondes sur une écoute distincte (défaut 9180). Les constats d’absence ci-dessous sont historiques pour ces éléments précis. Voir `EVOLUTION_API_OBSERVABILITE_2026_11_12.md` pour le périmètre, les preuves et les limites.

Les autres écarts restent ouverts. L’ajout de contrats ne met pas en place la Gateway ou le SSO ; l’instrumentation locale ne prouve pas le branchement au collecteur Cityz, la politique de déploiement ni l’ensemble des métriques métier.

## Relecture du 12 novembre 2026 — état après les nouvelles spécifications et JDD

**Verdict inchangé : conformité partielle ; projet non conforme en l’état à une livraison sur la plateforme décrite.** Le fonctionnement local, les tests métier et l’enrichissement des JDD ne constituent pas une validation de ce référentiel technique.

Relecture du PDF original de 60 pages, avec extraction du texte et contrôle visuel de la page imprimée 34 (chaînes d’authentification). Vérifications statiques renouvelées sur le code et l’arborescence actuels ; aucune modification applicative, de configuration ou de données pour cette relecture. Aucun test, scan de sécurité ou déploiement supplémentaire lancé pour cet audit. La vérification n’accède pas aux dépôts et réglages distants de Cityz Media.

### Constats renouvelés et preuves

| Domaine | État constaté | Preuve actuelle | Exigences, pages imprimées |
|---|---|---|---|
| Langages et frameworks | API autorisée ; front React autorisé mais mode de livraison non conforme | `apps/api/src/app.ts`, `apps/web/package.json`, `apps/web/vite.config.ts:24` | STK-001/002, p.20 |
| Typage et paquets | Typage strict, pnpm déclaré, lockfile présent ; JavaScript hors configuration à adapter | `tsconfig.base.json`, `package.json`, `pnpm-lock.yaml`, `scripts/start.mjs`, `scripts/transfert-jdd-centres.mjs` | STK-003/004, p.20 ; MNT-020, p.57 |
| Service du front | Écart observé : serveur Node/Nitro, absence de Caddy et de configuration publique runtime | `apps/web/vite.config.ts:24`, `apps/web/package.json` (`start`), relais `apps/web/src/routes/api/$.ts` ; aucun Caddyfile/Dockerfile dans le périmètre applicatif inspecté | STK-002/030/031/033, p.20–23 |
| Données | Écart observé : SQLite exclusif, migrations et scripts liés au fichier local | `apps/api/prisma/schema.prisma` (`provider = "sqlite"`), `apps/api/src/core/config.ts:8`, `apps/api/src/core/db.ts` | DON-001, p.30 ; DON-020 à 036, p.31 |
| Identité | Écart bloquant pour la production : seul mécanisme HMAC de développement, aucun validateur Bearer/JWKS observé | `apps/api/src/core/identity.ts`, `apps/api/src/core/config.ts:9` et `:36` ; refus explicite de démarrer avec `NODE_ENV=production` | SEC-012/013, p.34 |
| Autorisations | Contrôles serveur existants, mais calcul local sans service central | `apps/api/src/core/permissions/permissions.ts`, rôles et périmètres en base ; aucun adaptateur OpenFGA observé | SEC-020 à 023, p.35 |
| Contrats et exposition API | Écart observé : `/api` sans version majeure, contrats OpenAPI absents | `apps/api/src/app.ts:106` ; aucun `docs/api/` ou contrat OpenAPI identifié | PLT-050/051/052/056, p.28 |
| Observabilité et sondes | Partiel : logger et contrôle de santé existants ; instrumentation et sondes prescrites absentes | `apps/api/src/app.ts` (logger), `apps/api/src/modules/health/service.ts` ; aucun SDK OTel, OTLP, `/healthz/live`, `/healthz/ready` ni port 9180 identifié | EXP-001 à 013, p.46–47 ; EXP-020/021, p.48 |
| Déploiement et chaîne de livraison | Livrables non préparés dans cette copie ; état de la plateforme distante non vérifiable | Aucun Dockerfile, `.github/`, `VERSION`, CODEOWNERS ni Dependabot dans le périmètre inspecté ; manifests `0.0.0` | STK-020 à 035, p.21–23 ; CIC-003/004/007/010/020/030/033, p.37–40 ; MNT-022, p.57 |
| Tests et JDD | Base réutilisable : unitaires, intégration et E2E ; JDD récents fictifs et limités à dev.db. CI à chaque PR et recette formelle non démontrées | `apps/api/test/`, `e2e/`, `apps/api/scripts/seed-scenarios.ts` ; tests automatisés disponibles, sans validation UAT Cityz jointe | MNT-001/003/004, p.57 ; DOC-024/025, p.53 |
| Code et documentation | Écarts observés : noms/commentaires français, CLAUDE.md, organisation et formats documentaires | `apps/api/src/modules/reception/validation.ts`, `CLAUDE.md` ; répertoires prescrits et fichiers de gouvernance manquants | DOC-002/004, p.50 ; CIC-007, p.38 ; MNT-030 à 036, p.57–58 |

Les **catalogues JSON des JDD et du transfert ajoutés récemment sous `docs/_travail/` ne respectent pas DOC-004**, car ils ne sont pas des contrats OpenAPI sous `docs/api/`. Ils devront être déplacés dans un répertoire de données/outillage hors `docs/`, et les scripts qui les produisent adaptés. Même constat pour les anciens fichiers `.mjs` et `.sql` de travail sous `docs/`. Ce point n’est pas corrigé silencieusement pendant un audit.

### Ce qu’il faut adapter, sans refaire le métier

1. Valider avec Cityz Media la cible et les éventuelles dérogations. Le choix utilisateur Q-343 (SQLite et absence de Docker pour le développement local) reste respecté ; il ne vaut pas dérogation officielle pour une livraison Cityz. Ne pas migrer la base actuelle pendant cet audit.
2. Préparer une cible PostgreSQL, ses migrations et ses tests de concurrence ; préciser le stockage des fichiers, la reprise et l’archivage. Un BLOB n’est pas automatiquement interdit : la répartition entre base et stockage objet doit être justifiée.
3. Adapter le front en SPA statique servie par Caddy, lire `/config.json` au runtime, puis adapter les contrats et appels aux catégories d’API et chemins versionnés.
4. Remplacer les frontières d’identité et d’autorisation de production : jetons Bearer validés, service d’autorisation derrière une interface, correspondance des acteurs et centres. Préserver explicitement l’administrateur global et les garde-fous métier.
5. Ajouter OpenTelemetry, logs corrélés, métriques et sondes distinctes au port 9180 ; préparer les images et les entrées de déploiement compatibles avec la plateforme.
6. Brancher le workflow fourni par Cityz Media, ajouter les contrôles PR et les preuves de scans/SBOM, puis les livrables d’architecture, recette, exploitation et gouvernance.
7. Adapter les conventions de code et les chemins documentaires. Les identifiants internes/commentaires doivent passer en anglais ; les libellés métier français peuvent rester en français. Le renommage des contrats publics et colonnes physiques doit être traité avec compatibilité.

Les composants réception, stock, contrôle, NC, Bus, J−3, droits métier et leurs tests peuvent être conservés comme base. Le PDF ne démontre pas à lui seul la conformité fonctionnelle aux maquettes CIRCE, et les nouvelles fonctionnalités ne démontrent pas à elles seules la conformité technique Cityz.

La version du PDF reste `0.2.0-pre`, explicitement non contractuelle (p.19). Cette conclusion est une comparaison technique avec la cible demandée, pas une décision de recette ni un prononcé contractuel. Les approbations, protections GitHub, configurations GitOps, licences/scans, objectifs de sauvegarde et jalons restent à vérifier avec les preuves correspondantes.

## Points réutilisables

| Sujet | Observation | Référentiel |
|---|---|---|
| Technologies | API Fastify/TypeScript, front React/TypeScript : technologies admises. | STK-001/002, p.20 ; l'exigence de SPA statique reste à traiter. |
| Gestion des paquets | pnpm déclaré dans `package.json`, verrou `pnpm-lock.yaml`. | STK-004, p.20 ; MNT-020, p.57. |
| Typage | `strict: true` dans `tsconfig.base.json` ; les projets héritent de ce fichier. `allowJs` n'est pas activé, mais pourrait être déclaré explicitement à false pour clarifier la preuve. | STK-003, p.20. |
| Conventions | ESLint et Prettier configurés et commandes présentes. | MNT-010, p.57 ; leur contrôle en CI reste à préparer. |
| Tests | Tests unitaires, intégration API/base, E2E et JDD disponibles ; base de test distincte et garde-fou. | MNT-001/004, p.57. La couverture complète de la stratégie et l'exécution à chaque PR restent à démontrer. |
| Métier | Services, transactions, versions optimistes, idempotence persistée, historiques et droits serveur. | Bases utiles pour les adaptations ; l'autorisation externe requise par SEC-020 reste absente. |
| Configuration et arrêt | Configuration API par environnement ; traitement de SIGTERM et fermeture Fastify/base. | Bases partielles pour PLT-064/065, p.28-29. |
| Documentation | Nombreux documents en français, majoritairement Markdown ; identifiants stables EX/RG et matrice. | Bases pour DOC-001/003/021/023, p.50-53. Emplacements, contenus et validations à compléter. |

## 1. Front : adapter l'architecture de livraison

**Écart observé.** STK-002 impose une SPA produite en fichiers statiques. STK-030/031/033 imposent Caddy, son Caddyfile, le Dockerfile de référence et une configuration d'environnement chargée à l'exécution depuis `/config.json` (p.20-23).

Le projet utilise TanStack Start avec Nitro en `node-server` dans [vite.config.ts](../apps/web/vite.config.ts:24). Le démarrage web exécute `.output/server/index.mjs`. Le relais [routes/api/$.ts](../apps/web/src/routes/api/$.ts:24) dépend de `process.env` et signe l'identité de développement. Ce relais ne peut pas être exécuté par un serveur de fichiers statiques.

À faire :

1. Conserver React, les composants d'écrans et, si adapté, TanStack Router. Produire une véritable SPA statique ; retirer du livrable de production la dépendance au rendu/serveur Nitro.
2. Reprendre le client HTTP pour lire les URL et paramètres publics depuis `/config.json`, sans secret dans ce fichier et sans valeurs d'environnement intégrées au build.
3. Remplacer le relais serveur général par la chaîne d'accès imposée selon la catégorie de l'API ; cela demande d'adapter les appels, pas seulement la configuration de Vite.
4. Fournir Caddyfile et Dockerfile conformes au modèle. La CSP est fournie par les overlays, avec vérification des aperçus, impressions, téléchargements et composants qui peuvent dépendre de scripts ou styles.

Il n'est pas demandé de passer à Angular. React reste autorisé.

## 2. Données : migrer l'adaptateur SQLite et les migrations

**Écart observé.** DON-001 limite les services de données au catalogue PostgreSQL et Object Storage, sauf dérogation (p.30). Le projet force SQLite dans [config.ts](../apps/api/src/core/config.ts:8), [db.ts](../apps/api/src/core/db.ts:7), le schéma Prisma et les scripts dev/test.

La décision interne Q-343, autorisant SQLite et l'absence de Docker, explique ce choix local. Elle ne constitue pas, à elle seule, une dérogation Cityz Media approuvée selon CAD-100/101.

À faire :

- Adapter Prisma et la configuration à la base PostgreSQL dédiée au tenant. Prisma lui-même n'est pas interdit par le document.
- Porter les migrations SQL SQLite, index partiels, types, agrégations SQL et scénarios de concurrence ; conserver les noms et relations existants au moyen des mappings lorsque nécessaire.
- Rendre le pool configurable par réplica ; préparer TLS et validation des certificats selon PLT-033/034 ; prévoir la rotation des secrets sans reconstruire l'image (DON-010/022, p.27/31).
- Fournir la commande et l'image du Job de migration à Cityz Media. Tester rejeu, concurrence, compatibilité n-1, rollback applicatif et exécution sur un schéma plus récent (DON-030 à 036, p.31). Ne pas modifier rétroactivement des migrations déjà appliquées sur Staging/production.
- Porter l'isolation des tests et les JDD vers un environnement PostgreSQL local reproductible, indépendant de Staging et de la production. La base de démonstration actuellement alimentée peut rester un outil local tant qu'une cible compatible est clairement définie.

Les photos sont stockées en BLOB et servies par une API contrôlée. Le document ne rend pas automatiquement tout BLOB en PostgreSQL interdit : il faut décider et documenter la répartition base/stockage objet. Si les fichiers passent au stockage objet, utiliser les conteneurs du tenant et un accès via l'API, sans accès public (DON-040).

## 3. Identité : remplacer le mécanisme de développement dans la cible de production

**Écart observé et blocage de production actuel.** [identity.ts](../apps/api/src/core/identity.ts:86) ne reconnaît que `x-dev-identity`, signé HMAC. [config.ts](../apps/api/src/core/config.ts:36) refuse explicitement tout démarrage en production. Le client HTTP actuel ne gère pas le parcours Bearer exigé.

SEC-010 à 015 (p.34) demandent un SSO géré par le middleware Cityz Media, des API validant signature/émetteur/audience/expiration du jeton Bearer, et aucun jeton persistant côté navigateur. La SPA ne doit pas conduire l'authentification ni ajouter un login ou une gestion de mots de passe.

À faire :

- Introduire un validateur de jetons OIDC/JWKS indépendant d'un fournisseur spécifique, avec l'audience correspondant à chaque catégorie d'API.
- Identifier les utilisateurs SSO à partir des claims validés et définir leur correspondance avec les acteurs/historiques métier existants.
- Pour les API métier, récupérer le jeton via `GET /oauth2/auth`, le conserver uniquement en mémoire, le transmettre dans `Authorization: Bearer` et le renouveler après un 401 selon le document.
- Réserver profils fictifs et signature HMAC à un environnement de développement explicitement isolé ; aucun accès à Staging/production fondé sur ce cookie.
- Tester signature invalide, mauvais émetteur, mauvaise audience, expiration et absence de jeton, ainsi que l'accès aux fichiers protégés.

Le `sessionStorage` du panier et du centre sélectionné n'est pas, en soi, une violation de SEC-015 : cette interdiction vise les jetons, pas toute donnée d'interface. Aucun stockage de jeton Bearer n'est actuellement implémenté dans ces modules.

## 4. Autorisation : brancher le service central en conservant les droits métier

**Partiel sur le principe serveur, écart sur le mécanisme.** Les services contrôlent les droits côté API, mais [permissions.ts](../apps/api/src/core/permissions/permissions.ts:14) décide à partir d'un catalogue local et des rôles/périmètres en base. Aucun adaptateur vers le service central d'autorisation n'est présent.

SEC-020 à 023 (p.35) exigent une décision serveur par appel au service d'autorisation, une interface unique, un modèle versionné et la gestion des relations dans ce service, sans copie locale faisant foi. L'implémentation actuelle annoncée par Cityz Media est OpenFGA.

À faire : créer un port d'autorisation, son adaptateur, le modèle types/relations et la correspondance de chaque opération avec une vérification ; adapter les services synchrones actuels pour permettre ces appels. Prévoir les erreurs et indisponibilités du service ainsi que les créations/suppressions de relations.

**Préserver la demande de l'utilisateur : tous les administrateurs ont tous les droits et voient tous les centres.** Représenter cette relation globale dans le modèle d'autorisation, avec contrôles côté serveur. Wissous, Nîmes et Nanterre restent des centres métier de CIRCE ; ils ne deviennent pas automatiquement trois tenants techniques. Un tenant du document correspond à l'application sur la plateforme.

Conserver également les validations de quantité, les transitions et l'intégrité pour les administrateurs : leur accès global ne change pas la validité d'une opération métier.

## 5. API : versionner, contractualiser et répartir les accès

**Écart observé.** Le préfixe global est `/api`, sans version majeure ([app.ts](../apps/api/src/app.ts:97)). Les schémas Zod ne constituent pas un contrat OpenAPI 3.x versionné ; aucun contrat ni répertoire `docs/api/` n'a été retrouvé.

PLT-050 à 056 (p.28) demandent des contrats à jour, une version majeure dans les chemins, le classement des API et une API métier publiée sur la Gateway depuis une autre origine que le front. Les contrôles CORS sont en amont, pas dans Fastify.

À faire : classer les opérations de réception/coordination/stock comme ressources métier selon le dossier validé ; traiter séparément les éventuelles API techniques d'interface. Publier les contrats sous `docs/api/`, introduire `/v1/...`, adapter clients et tests, déclarer audiences, quotas, origines et consommateurs à Cityz Media. Ne pas ajouter automatiquement un plugin CORS dans l'API.

## 6. Exploitation et sécurité des déploiements

**Livrables locaux absents ; configuration déployée non vérifiable.** Aucun Dockerfile, Caddyfile ni `.dockerignore` n'est présent dans la copie. Les fichiers de déploiement GitOps peuvent se trouver dans le dépôt séparé fourni par Cityz Media : leur absence du dépôt applicatif n'est pas, seule, une faute.

À préparer : images multi-étapes, bases distroless imposées avec version/digest, exécution non root sans outils de build, `.dockerignore` excluant notamment `.env*` (STK-020 à 035, p.21-23). Déclarer les ports, CPU/mémoire/stockage, temps de démarrage et chemins d'écriture. Vérifier le fonctionnement sous racine en lecture seule, utilisateur non privilégié et contraintes restricted (PLT-060 à 069, SEC-060 à 062, p.28-29/36).

Le fichier SQLite local est incompatible avec la cible de plusieurs réplicas autonomes partageant le même état. Les traitements planifiés ont déjà des verrous persistés : ne pas affirmer qu'ils sont dépourvus de protection. Il reste à démontrer leur comportement multi-instance, lors d'un arrêt et après incident sur la base cible.

Les jobs planifiés et intégrations entre systèmes sont explicitement hors périmètre du cadre (§2.2, p.7). Les composants Broadcast, mails/machines et ordonnanceurs de CIRCE doivent être identifiés et cadrés avec Cityz Media. Le PDF n'impose pas à lui seul de les réécrire en CronJobs ni de supprimer ces fonctionnalités.

SIGTERM est déjà traité, mais le drainage complet des tâches en cours dans le délai de grâce et le remplacement de nœud restent à tester (PLT-011/064). L'exigence d'au moins deux réplicas et d'un PDB dépend de la continuité de service demandée au cahier des charges (PLT-012), même si le support de plusieurs réplicas est requis par PLT-061.

## 7. Observabilité : compléter le code et les sondes

**Écart observé.** Aucun SDK/instrumentation OpenTelemetry retrouvé dans les dépendances ou dans le code. Le logger Fastify est présent, avec niveau configurable et masquage de deux en-têtes sensibles, mais pas de modèle OTel complet ni corrélation trace/span et attributs de ressource.

EXP-001 à 006/010 à 013 (p.46-47) : instrumenter HTTP entrant/sortant et accès aux données ; exporter traces et métriques en OTLP ; configuration uniquement via variables OTel ; conventions sémantiques et faible cardinalité. Émettre les logs Fastify JSON sur stdout avec le modèle demandé, sans second canal applicatif.

Le seul endpoint actuel est `/api/health`, sur le port de service, et il interroge la base ([health/service.ts](../apps/api/src/modules/health/service.ts:8)). Pour EXP-020/021 (p.48), créer une seconde instance Fastify sur le port d'administration 9180 : `/healthz/live` vérifie seulement le processus ; `/healthz/ready` vérifie les dépendances indispensables. Ce port ne doit pas être exposé par la HTTPRoute.

Ajouter les métriques métier préfixées CIRCE et leur catalogue avec unités, seuils et actions (EXP-030/031). Les alertes métier affichées dans l'application ne remplacent pas ces métriques. Aucun SDK de télémétrie navigateur n'est exigé ; le front Caddy fournit ses propres logs/métriques.

Pour SEC-050/051 (p.36), journaliser explicitement refus d'autorisation et opérations sensibles avec l'identité ; vérifier qu'aucun cookie, jeton ou secret n'apparaît. Le journal métier en base et les réponses HTTP 403 ne démontrent pas seuls cette journalisation de sécurité. Aucune recherche exhaustive de secrets historiques ni analyse des logs réels n'a été effectuée ici.

## 8. CI/CD, GitOps et versionnement : construire la chaîne prescrite

**Non préparé dans cette copie ; propriétés distantes non vérifiables.** Pas de `.github/`, workflow, CODEOWNERS, Dependabot ou `VERSION`. Les manifests déclarent `0.0.0`, sans fichier de version majeur.mineur correspondant. L'organisation GitHub, les protections de branche et le dépôt GitOps n'ont pas été inspectés.

À faire selon CIC-003 à 065 et MNT-003/011/012/021/022 (p.37-44/57) :

1. Utiliser le dépôt applicatif créé par Cityz Media ; vérifier versionnement, PR obligatoires, relecteurs et protections. Le Git local de cette copie ne montre aucun fichier suivi : cela ne démontre pas l'absence d'un dépôt officiel ailleurs, mais cette copie n'apporte pas cette preuve.
2. Ajouter les jobs PR de typage, tests, lint/format et Conventional Commits. Épingler les actions tierces par SHA, permissions minimales, restauration verrouillée.
3. Ajouter l'appel au workflow réutilisable **fourni par Cityz Media**, seul producteur d'images déployables. Ne pas en inventer l'URL/référence ni lui substituer un pipeline de publication personnel.
4. Créer `VERSION` en MAJEUR.MINEUR et aligner les manifests. Utiliser les tags de build horodatés avec SHA prescrits ; même image de Staging à production, sans reconstruction.
5. Renseigner les entrées des overlays du dépôt GitOps fourni. L'équipe applicative ne réécrit pas les charts, ResourceSet, workflows ou politiques réseau communs de sa propre initiative (CIC-051, PLT-032).
6. Obtenir les résultats SAST, détection de secrets, scan des images/dépendances et SBOM du workflow imposé ; traiter les constats requis et vérifier les licences applicatives autorisées (STK-040/041). Aucun verdict de sécurité ou de licences ne peut être déduit du seul lockfile.

Les composants communs de plateforme sont portés par Cityz Media ; le tableau p.42-43 précise leur répartition. Les hôtes, noms de tenant, registres, audiences, secrets, paramètres de ressources et flux sortants nécessitent les informations de cadrage de Cityz Media.

## 9. Langue et organisation du code : refactorer avec compatibilité

**Écart observé étendu.** DOC-002 (p.50) demande des identifiants, commentaires et messages de commit en anglais. Le code actuel utilise largement des noms tels que `validerReception`, `receptionAttendue`, `quantite` et des commentaires en français. Les messages de commit historiques n'ont pas été audités.

À faire : renommer progressivement les symboles internes et traduire les commentaires ; conserver les identifiants de règles RG et les libellés métier français destinés aux utilisateurs. Distinguer noms internes, contrats JSON publics et schéma physique : leur renommage aveugle créerait des ruptures. Préserver les colonnes historiques par mappings, et versionner toute rupture d'API réellement choisie.

STK-003 (p.20) réserve le JavaScript aux configurations de build : `scripts/start.mjs`, script d'exécution, doit être porté en TypeScript ou faire l'objet d'une dérogation. Le script de contrôle `.mjs` sous `docs/` doit aussi être sorti des livrables documentaires et réévalué sous cette règle.

**Recommandation forte, pas obligation absolue :** MNT-013 (p.57) recommande l'architecture hexagonale. Des ports Broadcast/Mail/Machine existent déjà, mais des services métier dépendent directement de types/clients Prisma. Isoler domaine, ports et adaptateurs est recommandé ; un écart peut être justifié dans le dossier d'architecture sans prétendre qu'une réécriture intégrale est exigée.

## 10. Documentation, recette et gouvernance : réorganiser et compléter

**Partiel sur le contenu, écart observé sur les livrables exigés.** Les documents actuels sont utiles, mais ne constituent pas encore le dossier prescrit et approuvé.

À préparer :

| Livrable / adaptation | Exigences / pages |
|---|---|
| `docs/architecture/` : composants, flux, catégories d'API, sécurité, tenant, ressources, runtime/support, secrets, données, archivage et ENF mesurables. Soumission/approbation Cityz Media. | CAD-020/021, DOC-010 à 012 ; p.14/51-52. |
| `docs/specifications/` et `docs/acceptance/test-cases/` : reprendre EX/RG, préconditions/JDD, étapes et résultats attendus. | DOC-020 à 022 ; p.52. |
| `docs/acceptance/traceability.md`, campagnes portant version et build, résultats par cas, anomalies et décision nominative du Responsable Métier. | DOC-023 à 026 ; p.53. |
| `docs/operations/` : démarrage/arrêt, diagnostic, rollback, reprise/rejeu, indicateurs, incidents connus. Démonstration de reprise sur Staging avant production. | EXP-040 à 042 ; p.48-49. |
| `docs/adr/` : décisions structurantes ; `docs/exceptions/` : dérogations formelles avec décision, auteur, date et échéance. | MNT-031, CAD-100 à 102 ; p.17-18/58. |
| `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, environnement `.devcontainer/` ou `compose.yaml`. | MNT-030 à 036 ; p.57-58. |
| Migrer les instructions de `CLAUDE.md` vers le seul `AGENTS.md`, puis retirer les instructions concurrentes après reprise contrôlée. | CIC-007 ; p.38. |
| CODEOWNERS sur architecture, exceptions, jalons, spécifications, recette, sécurité et workflow imposé. | CIC-004, DOC-010/026 ; p.37-38/51/53. |
| `docs/milestones/`, supports de transfert et préparation de fin de garantie. | CAD-050 à 053/090 ; FIN-001 à 021 ; p.15-17/54-55. |

DOC-004 (p.50) n'autorise pas les scripts `.mjs`, dumps `.sql` ni JSON ordinaires sous `docs/`. Des fichiers de ces types existent dans `docs/_travail/` : les déplacer hors `docs/`, ou convertir leur contenu documentaire en Markdown selon leur usage. Le JSON OpenAPI reste autorisé uniquement dans `docs/api/`. Les schémas doivent être en Mermaid/Excalidraw avec sources versionnées (DOC-006). Les PDF, Word et archives ne doivent pas être ajoutés dans `docs/`.

La purge fonctionnelle des lignes attendues ne constitue pas une politique d'archivage de toute l'application. Définir conservation active/archive, sort final des données et fichiers, restauration d'archive et approbation métier (DON-050/060 à 063, p.32). Ces durées peuvent avoir un effet métier : les faire définir/valider, sans les inventer pendant la migration technique.

Les profils et JDD fictifs récents sont compatibles avec l'objectif de DOC-024, mais l'absence de toute donnée de production dans l'intégralité des fixtures nécessite une vérification de provenance. Les centres métier et les droits administrateur ne sont pas remis en cause par le document.

Les validations J1/J2/J3/J4/J5, les engagements de garantie, les accès nominatifs, la révocation et la destruction des copies ne peuvent pas être certifiés par lecture du dépôt. Les résultats automatisés ne remplacent ni recette technique Cityz Media, ni décision UAT, ni comptes rendus approuvés.

## Plan proposé : quoi recoder, adapter ou fournir

| Ordre | Nature | Travail | Critère de sortie |
|---|---|---|---|
| 1 | Cadrer | Confirmer la version applicable et le statut prototype/livraison ; obtenir tenant, workflow, GitOps, audiences et exigences non fonctionnelles ; traiter SQLite/SSR par cible conforme ou dérogation. | Architecture et liste des écarts validables ; pas de décision implicite sur les RG. |
| 2 | Adapter le socle données | PostgreSQL, migrations, pool/TLS, intégration et JDD sur base cible. | Régressions métier, concurrence et n-1 vérifiées sur PostgreSQL. |
| 3 | Recoder les frontières de sécurité | Bearer validé, parcours middleware, port d'autorisation/service central, admin global et périmètres locaux. | Tests positifs/négatifs sur identité, droits, ressources et centres. |
| 4 | Adapter le front et les contrats | SPA statique, Caddy, `/config.json`, `/v1`, OpenAPI, routes selon catégorie. | Images et appels compatibles avec les chaînes d'entrée, même build entre environnements. |
| 5 | Ajouter l'exploitation | OpenTelemetry, logs, métriques, sondes 9180, arrêt/drain et ressources. | Vérifications sur Staging, rootfs en lecture seule, remplacement de nœud et dépendances indisponibles. |
| 6 | Industrialiser | CI fournie, jobs PR, SBOM/scans, version et overlays GitOps. | Build traçable et promotion sans reconstruction. |
| 7 | Refactorer et documenter | Anglais interne, ports/adaptateurs, AGENTS, ADR, dossier de recette/exploitation et transfert. | Preuves exigées et jalons approuvables. |

Les lots se recouvrent : les contrats et les droits doivent être décidés avant de figer le client. Ne pas traiter ce plan comme un chiffrage en jours ; le volume dépend notamment des contrats Broadcast et des éléments fournis par Cityz Media.

**Bilan pratique : conserver le métier et React/Fastify ; adapter profondément stockage, identité/autorisation et mode de service du front ; ajouter l'industrialisation, l'observabilité et les livrables prescrits.** Aucun changement applicatif ni de données réalisé pour cette comparaison.
