# Audit fonctionnel et technique CIRCE — 16 novembre 2026

## 1. Verdict et portée

**L’application dispose d’un socle fonctionnel développé et fonctionne localement. Elle n’est pas encore complète sur tout le périmètre des maquettes et n’est pas prête pour une mise en production Cityz.** Les principaux obstacles concernent les systèmes externes, certaines fonctions industrielles, des arbitrages métier et la cible d’hébergement/sécurité.

Les deux derniers chantiers techniques, **versionnement API/OpenAPI** et **OpenTelemetry/sondes distinctes**, sont développés. Il ne faut plus les présenter comme absents. Leur raccordement à la plateforme Cityz reste à démontrer.

Cet audit ne modifie aucun code applicatif, règle métier, configuration ou jeu de données. Seul ce document est ajouté. Les décisions utilisateur restent applicables : administrateur global, centres Wissous/Nîmes/Nanterre, SQLite local, conservation des garde-fous Bus pour les ajustements, les quantités nulles et le « reste en place ».

### Méthode et limites

Revue de l’arborescence actuelle, des routes, des adaptateurs externes, de l’identité, des sondes, de l’instrumentation, des tests en attente et des registres de réalisation/écarts. Contrôles exécutés ce jour : typage, tests unitaires, fraîcheur des contrats et santé HTTP.

Les détails des évolutions des maquettes proviennent du registre du 12 novembre, confronté aux modules actuellement présents. **Ce n’est pas une nouvelle recette visuelle exhaustive de chaque écran ni une relecture intégrale de tous les DOCX/PDF.** Les constats Cityz reprennent l’audit du PDF fourni, corrigé des réalisations ultérieures ; aucune vérification distante de Staging, de GitOps ou des services Cityz n’a été effectuée.

Statuts : **développé** = réalisation présente avec preuves identifiées ; **partiel** = réalisation utile mais cible incomplète ; **bloqué** = besoin d’une décision ou dépendance externe ; **non démontré** = preuve de recette/exploitation absente. « Développé » ne signifie pas « certifié conforme à toutes les spécifications ».

## 2. Ce qui est développé

| Domaine | Réalisation actuelle | Preuves dans le dépôt | Limite à conserver visible |
|---|---|---|---|
| Réception | Réceptions attendues, affiches, inconnues, rattachements, contrôle, stock lié aux affiches, historique et validation administrative | `apps/api/src/modules/reception/`, `apps/web/src/routes/reception/`, tests réception | Reconnaissance automatique et impression industrielle non abouties ; écran Stocks dédié absent |
| Évolutions Réception | Sans BL explicite, sélection manuelle du panier, glissement, validation distincte de l’impression, validation administrative en lot, enrichissement des fiches | `docs/REGLES_METIER_NOUVELLES_SPECS_2026_11_12.md`, routes et composants réception | Ne pas assimiler ces évolutions à une refonte exhaustive de tous les champs hérités |
| Coordination | Instructions, validation, déblocage, trains, préparation unitaire, roulage, dispatch, bagues et génération de lots | `apps/api/src/modules/coordination/`, `apps/web/src/routes/coordination/` | Contrats machines réels, certains cas de production et arbitrages UM restent ouverts |
| Expédition | Colis, rattachements d’unités, transitions, départs et impressions navigateur | `coordination/colis.ts`, `coordination/departs-camions.ts`, routes web `expedition/` | Transporteur, preuve de livraison et représentation détaillée des départs restent partiels |
| Non-conformités | Déclarations réception/agence, décisions, suivi, justificatifs persistés et référentiel des déclarants | `apps/api/src/modules/nonconformite/`, `apps/web/src/routes/non-conformite.tsx` | Recette métier exhaustive et échanges externes non démontrés ; l’ancien constat « module absent » est périmé |
| Bus | Cinq vues, référentiel, grain centre × parc × format, contrôles et ajustements manuels historisés | `apps/api/src/modules/bus/`, `apps/web/src/routes/bus.tsx` | Flux réels Broadcast/Field Service non validés ; garde-fous conservés conformément à la décision utilisateur |
| Pilotage | Tableau de bord, dispositions personnelles, notes, alertes et filtres ; J−3 avec tableaux hebdomadaires et annotations | `apps/api/src/modules/pilotage/`, routes web `pilotage/`, `reception/j3.tsx` | Le tableau de bord n’équivaut pas au suivi global de production complet |
| Administration | Utilisateurs, rôles, périmètres, paramètres, sites, référentiels réception/Bus et déclarants | `apps/api/src/modules/admin/`, routes web `admin/` | Référentiels machines, gammes, transport et fonctions de production non tous repris |
| Droits | Toutes les permissions pour le rôle admin, accès global calculé côté serveur ; contrôles métier conservés | `core/permissions/permissions.ts`, `core/identity.ts` | L’accès global ne supprime ni les validations ni le contexte du centre sélectionné |
| JDD | Graines reproductibles et catalogue documenté de 222 scénarios, réception, sans IP, échéances et NC sur les trois centres | `apps/api/scripts/seed-scenarios.ts`, documents JDD du 12 novembre | Chiffre du catalogue historique, pas recompte de la base ce jour ; aucun catalogue fini ne prouve « tous les scénarios possibles » |
| API | `/v1` et `/api` enregistrent les mêmes routes avec les mêmes adaptateurs ; contrats métier et administration | `apps/api/src/app.ts`, `core/openapi.ts`, `docs/api/` | Gateway, origine publique et identité de production restent à intégrer |
| Observabilité | SDK OpenTelemetry, traces HTTP/Fastify/Prisma/fetch, métriques techniques, logs JSON corrélés, filtrage des traces | `apps/api/src/core/observability/`, `server.ts`, `server-runtime.ts` | Collecteur Cityz, tableaux de supervision et alertes d’exploitation non démontrés |
| Sondes | `/healthz/live` sans dépendance, `/healthz/ready` avec contrôle base/délai/drainage, écoute séparée | `core/observability/admin.ts`, `core/config.ts`, `scripts/start.mjs` | Port par défaut 9180 ; le démarreur local peut choisir le suivant si occupé. Le port réel doit être fixé/configuré pour le déploiement |

## 3. Ce qui reste incomplet ou bloqué

### 3.1 Dépendances externes et exploitation

| Priorité | Sujet et état | Ce qui manque | Action nécessaire / condition de clôture |
|---|---|---|---|
| P0 — production | **Authentification : bloquée pour la production** | Identité `dev` uniquement ; `loadConfig` refuse explicitement `NODE_ENV=production` | Fournir le contrat SSO/jetons et intégrer un fournisseur de production avec tests de sécurité ; ne pas retirer simplement cette garde |
| P0 — intégration | **Broadcast : non raccordé** | `BroadcastNonConfigure` refuse lecture/envoi ; les services de transformation et de retour existent | Contrats réels, accès, correspondances, jeux d’échange et recette aller/retour ; Q-005 et RG-X-022 |
| P0 — exploitation industrielle | **Machines et impression : partiels** | `MachineSimulee` et `MockSiteAgent` ne prouvent ni envoi machine ni impression physique | Formats et protocoles, matériel de test, agent d’impression, accusés/erreurs ; Q-002, Q-193/Q-194 |
| P0 — livraison Cityz | **Cible technique : écarts ouverts** | SQLite, serveur web Nitro et autorisations locales diffèrent de la cible décrite dans le PDF | Valider cible ou dérogations, puis planifier les adaptations compatibles ; aucune migration autorisée par ce seul audit |
| P0 — exploitation réelle | **Reprise et restauration : non démontrées** | Pas de recette de reprise historique ni de restauration complète prouvée | Inventaire/mapping, essais de reprise, réconciliation, procédure sauvegarde/restauration et critères de reprise validés |
| P1 | **Mails : partiels** | Mode dev simulé par défaut ; SMTP présent, STARTTLS absent | Valider relais/TLS, événements, destinataires et politique de bascule des mails simulés ; tester erreurs et reprises sans envoyer de mails pendant cet audit |
| P1 | **Ordonnancement : à configurer/recetter** | Horaires vides = tâches désactivées ; source externe requise pour certains traitements | Fournir les horaires validés, activer en environnement approprié et vérifier chaque traitement ; ne pas inventer de cadence |
| P1 | **Observabilité Cityz : raccordement non démontré** | Exporteurs disponibles mais aucune preuve de collecte Cityz et de supervision opérationnelle | Configurer `OTEL_*`, réseau, ressources, conservation, tableaux et alertes ; contrôler l’isolement du port des sondes |
| P1 | **Livraison et sécurité : preuves manquantes** | CI/CD Cityz, images/manifests, scans/SBOM, gouvernance, recette et protections distantes non établis par cet audit | Préparer les livrables puis obtenir les preuves de plateforme ; ne pas déduire leur absence distante du seul dépôt local |

### 3.2 Fonctions et décisions métier à compléter

| Sujet | État / conséquence | Prochaine étape sans changer arbitrairement les règles |
|---|---|---|
| Stocks dédié / fin de campagne | Les services de mouvement existent, mais pas d’écran complet Stocks par affiche / mouvements / fin de campagne dans les routes inspectées | Reprendre D-13 et les exigences associées ; préciser destruction et droits, puis développer les écrans manquants |
| Suivi global de production | Pilotage et suivi Bus présents ; suivi transversal complet non livré | Comparer chaque vue attendue aux services et données disponibles ; ne pas déclarer l’ensemble terminé grâce au seul tableau de bord |
| Multi-rouleuse / fichiers industriels | Générateur et lots présents, cible GEN-02 et raccordements machines incomplets | Obtenir le format réel et la recette machine ; compléter le parcours couvert par la maquette |
| Reconnaissance des affiches | Identification manuelle opérationnelle ; reconnaissance visuelle automatique non démontrée | Définir fournisseur, données et critères de reconnaissance, avec validation humaine ; Q-112/Q-125 |
| Complément reçu sur affiche déjà validée | Nouvelle proposition autonome « A_CONFIRMER_PROPOSE » non modélisée ; test `todo` RG-X-061 | Arbitrer Q-399 avant modification ; préserver la validation du lot initial |
| Surplus partagé entre dossiers | Rattachement manuel disponible ; proposition automatique et confirmation non réalisées, RG-X-016 | Définir le parcours Q-419 si demandé ; conserver le traitement manuel actuel jusque-là |
| Affiches tardives / production engagée | Recalcul ciblé hors EN_PROD et production séparée d’une dernière minute non entièrement démontrés ; RG-X-085/RG-X-077 | Arbitrer Q-280/Q-282, puis tests nominaux/rejets et recette des effets croisés |
| Quantité après colisage | ANO-063/Q-418 : la quantité modifiée d’une ligne peut ne pas suivre celle de son UM | Décider entre interdiction et propagation ; aucune correction silencieuse, car elle changerait le comportement |
| Comptage à zéro | ANO-064/Q-416 : minimum de lien à 1 malgré stock nul | Décider le traitement du lien ; conserver le comportement tant que non arbitré |
| Campagne contrôlée | Test RG-COO-204 en attente : entretien 15 % / position du visuel, Q-257 | Valider la règle applicable puis compléter calculs et tests |
| Libération / construction des UM | Fonctionnement implémenté sous hypothèses Q-265/Q-404 | Faire valider les hypothèses opérationnelles ; ne pas présenter « code présent » comme « décision métier signée » |
| Livraison transporteur | Colis/expédition présents, preuve de livraison et intégration transport non complètes | Contrat transport, statuts et événements validés ; recette réelle |

Les huit tests en attente confirment des limites identifiées ; ils ne représentent pas la liste exhaustive des fonctionnalités manquantes.

## 4. Qualité documentaire et points à ne pas interpréter à tort

1. **Les anciens audits ne sont pas entièrement à jour.** L’audit Cityz contient encore des tableaux historiques indiquant OpenAPI/OTel absents, malgré l’addendum de réalisation. Les registres anciens mentionnent aussi les NC et certaines vues Bus comme absentes. Lire les évolutions du 12 novembre en priorité pour ces points précis.
2. **Le test en échec attendu sur le périmètre administrateur contredit la décision utilisateur.** `apps/api/test/reception/stock-alertes-complement.int.test.ts` attend un refus hors périmètre. Le code donne bien l’accès global à l’administrateur. Il faut réaligner test et registre Q-179/Q-421 sur cette décision, sans restreindre l’admin. Aucune modification effectuée ici.
3. **Pas de pourcentage global fiable.** La matrice historique et les nouveaux registres se recouvrent sans consolidation complète. Additionner leurs statuts donnerait une précision trompeuse.
4. **JDD et compteurs sont datés.** Les échéances J−3 dépendent des paramètres et du calendrier ; un compteur variable ne prouve pas un défaut. Les graines ne remplacent ni la recette métier ni les données réelles.
5. **Les règles legacy non reprises restent à arbitrer.** Le registre historique ne constitue pas une autorisation de les supprimer ni une preuve qu’elles sont toutes encore absentes ; leur statut doit être réconcilié exigence par exigence avec les nouveaux développements.
6. **Le PDF Cityz 0.2.0-pre reste une version de travail.** Les écarts décrivent la cible auditée, pas une décision contractuelle. SQLite reste la décision locale de l’utilisateur ; une adaptation plateforme requiert un périmètre explicite.

## 5. Vérifications et niveau de preuve

### Rejouées le 16 novembre 2026

| Contrôle | Résultat | Portée |
|---|---|---|
| `pnpm typecheck` | Réussi | Typage des paquets et scripts couverts |
| `pnpm test` | **294 tests réussis** : 16 shared, 36 web, 242 API | Tests unitaires ; pas une recette fonctionnelle exhaustive |
| `pnpm api:contract:check` | Réussi pour les deux contrats | Fraîcheur des contrats générés |
| `GET http://127.0.0.1:3000/api/health` | **HTTP 200**, `status: ok`, `database: up` | Web/relais/API/base accessibles au moment du contrôle |
| Revue des tests différés et adaptateurs | Réalisée | Huit `todo`, alternative admin en `it.fails`, intégrations non configurées identifiées |

Logs locaux : `/tmp/circe-audit-20261116-typecheck.log`, `/tmp/circe-audit-20261116-unit.log`, `/tmp/circe-audit-20261116-contract.log`. Ces fichiers temporaires ne constituent pas un archivage durable de recette.

### Résultats antérieurs, non rejoués pour cet audit

Le rapport du 12 novembre consigne **3 727 tests d’intégration réussis**, un échec attendu, huit tests à faire et un fichier ignoré ; **108 E2E réussis**, lint et build réussis. Il consigne également une collecte OTLP locale réelle et la vérification de séparation des sondes. Ce sont des preuves historiques, pas de nouvelles exécutions du 16 novembre.

Aucun nouveau test de charge, scan sécurité, test d’impression physique, recette Broadcast/Field Service, reprise de données ni test de production Cityz n’a été réalisé.

## 6. Ordre de traitement recommandé

1. **Consolider la traçabilité** : réconcilier matrice, anciens écarts, nouvelles réalisations et décisions utilisateur ; retirer les faux blocages documentaires sans masquer les vrais.
2. **Recetter les parcours existants** avec Réception, Coordination, responsables des trois centres et admin : cas nominaux, rejets, pièces jointes, NC, Bus, sans IP et J−3.
3. **Faire trancher les décisions métier restantes** listées en §3.2 avant de coder leurs conséquences. Les décisions déjà données, notamment admin global et garde-fous Bus, n’ont pas à être redemandées.
4. **Compléter les écrans/parcours manquants** sur exigences validées : Stocks, suivi global, multi-rouleuse et cas inter-modules.
5. **Raccorder les systèmes externes** avec contrats et environnements de recette : Broadcast, impression, machines, mails, transport et Field Service selon le périmètre retenu.
6. **Préparer la livraison Cityz** dans un lot séparé et autorisé : identité/autorisation, cible d’hébergement, données, livraison, supervision et reprise/restauration.

Une clôture doit fournir, pour chaque exigence : source, réalisation, tests nominaux/rejets, recette métier et preuve externe quand nécessaire. Aucun de ces travaux n’est lancé automatiquement par ce rapport.

## 7. Documents de référence

- [Évolutions des nouvelles spécifications](EVOLUTIONS_NOUVELLES_SPECS_2026_11_12.md)
- [Règles des nouvelles spécifications et décisions conservées](REGLES_METIER_NOUVELLES_SPECS_2026_11_12.md)
- [API et observabilité : réalisation et tests](EVOLUTION_API_OBSERVABILITE_2026_11_12.md)
- [Contrats API](api/README.md) et [exploitation de l’observabilité](operations/observabilite.md)
- [Matrice historique](MATRICE_TRACABILITE_SPECIFICATIONS.md), [écarts](ECARTS_EXISTANT_VS_CIBLE.md) et [questions ouvertes](QUESTIONS_OUVERTES.md)
- [Audit Cityz, avec constats historiques à contextualiser](AUDIT_STANDARDS_CITYZ_0_2_0_PRE.md)
- [JDD réception/pilotage/NC](JDD_PLUS_RECEPTION_PILOTAGE_NC_2026_11_12.md) et [sans IP/échéances](JDD_SANS_IP_ECHEANCES_2026_11_12.md)
